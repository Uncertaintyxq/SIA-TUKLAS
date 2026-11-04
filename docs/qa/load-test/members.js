// Load test for PERF-1 (SRS 5.1): 100 members using Tuklas at once. Run with k6, see README.md.
//
//   k6 run -e LOADTEST_PASSWORD=... docs/qa/load-test/members.js
//
// The 100 accounts (loadtest-001 to loadtest-100) are made on the server first by
// loadtest-accounts.php. Each simulated member signs in once, then keeps opening the screens a
// member uses (feed, a work, the library, a publication, a portfolio, search, chat), with pauses like
// a person reading. It only reads: nothing is posted, reacted to or changed.
//
// Why it ramps up slowly: signed out, the site allows 20 sign-ins a minute from one address, so the
// members join over 6 minutes. Only the time with all of them signed in counts for PERF-1
// (requests tagged phase:full).

import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE = __ENV.BASE_URL || 'https://junmm.me';
const PASSWORD = __ENV.LOADTEST_PASSWORD;
const DOMAIN = __ENV.LOADTEST_DOMAIN || 'tu.junmm.me';
const USERS = Number(__ENV.USERS || 100);
const RAMP_MINUTES = Number(__ENV.RAMP_MINUTES || 6);
const HOLD_MINUTES = Number(__ENV.HOLD_MINUTES || 5);

// The showcase's public works and publications, and people to look up
const WORKS = [1, 2, 3, 7];
const PUBLICATIONS = [1, 4];
const PEOPLE = ['andrea', 'paolo', 'kim', 'msantos', 'raquino'];
const SEARCHES = ['flood', 'mangrove', 'poems', 'santos', 'river'];

export const options = {
  scenarios: {
    members: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: `${RAMP_MINUTES}m`, target: USERS },
        { duration: `${HOLD_MINUTES}m`, target: USERS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // PERF-1: with every member active, 95% of API requests answered within 1 second
    'http_req_duration{kind:read,phase:full}': ['p(95)<1000'],
    // Almost no errors, and the rate limits not hit
    'http_req_failed{kind:read}': ['rate<0.01'],
    'checks{kind:read}': ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const HEADERS = { Accept: 'application/json', Referer: `${BASE}/`, Origin: BASE };

export function setup() {
  if (!PASSWORD) throw new Error('Set the test accounts\' password: k6 run -e LOADTEST_PASSWORD=... members.js');
  return { fullFrom: Date.now() + RAMP_MINUTES * 60 * 1000 };
}

let signedIn = false; // per simulated member (each VU has its own copy)

function tags(data, name) {
  return { kind: 'read', name, phase: Date.now() >= data.fullFrom ? 'full' : 'ramp' };
}

function get(data, path, name) {
  const res = http.get(`${BASE}${path}`, { headers: HEADERS, tags: tags(data, name) });
  check(res, { 'status 200': (r) => r.status === 200, 'not rate limited': (r) => r.status !== 429 }, { kind: 'read' });
  return res;
}

function signIn() {
  const email = `loadtest-${String(__VU).padStart(3, '0')}@${DOMAIN}`;
  for (let attempt = 1; attempt <= 6; attempt++) {
    http.get(`${BASE}/sanctum/csrf-cookie`, { headers: HEADERS, tags: { kind: 'auth' } });
    const cookies = http.cookieJar().cookiesForURL(BASE);
    const token = cookies['XSRF-TOKEN'] ? decodeURIComponent(cookies['XSRF-TOKEN'][0]) : '';
    const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email, password: PASSWORD }), {
      headers: { ...HEADERS, 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token },
      tags: { kind: 'auth' },
    });
    if (res.status === 200 || res.status === 204) return true;
    if (res.status !== 429) {
      console.error(`${email}: sign-in failed with ${res.status}: ${String(res.body).slice(0, 200)}`);
      return false;
    }
    sleep(10 * attempt); // the sign-in limit: wait and try again
  }
  console.error(`${email}: still rate limited after 6 tries`);
  return false;
}

const pause = (min, max) => sleep(min + Math.random() * (max - min));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export default function (data) {
  if (!signedIn) {
    signedIn = signIn();
    if (!signedIn) {
      sleep(30);
      return;
    }
  }

  group('feed', () => {
    get(data, '/api/auth/me', 'me');
    get(data, '/api/feed', 'feed');
    get(data, '/api/feed/sidebar', 'feed sidebar');
    get(data, '/api/notifications', 'notifications');
    get(data, '/api/announcements/unread', 'announcements unread');
    get(data, '/api/chat/unread', 'chat unread');
  });
  pause(5, 12);

  group('work', () => get(data, `/api/works/${pick(WORKS)}`, 'work'));
  pause(8, 20);

  group('library', () => {
    get(data, '/api/publications/browse', 'library');
    get(data, `/api/publications/${pick(PUBLICATIONS)}`, 'publication');
  });
  pause(5, 12);

  group('people', () => {
    get(data, `/api/people/search?q=${pick(SEARCHES)}`, 'search');
    get(data, `/api/users/${pick(PEOPLE)}/portfolio`, 'portfolio');
  });
  pause(5, 12);

  group('chat', () => get(data, '/api/chat/conversations', 'conversations'));
  pause(5, 12);
}
