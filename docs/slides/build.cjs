/**
 * Builds docs/Tuklas Presentation.pptx, the slide deck that follows the SRS.
 *
 * The course asks for three parts: Company Background, Problems Encountered (PIECES) and Test
 * Results. The other slides were approved on 2026-11-04. Content comes from the SRS (docs/srs/),
 * the QA checklist (docs/qa/checklist.md, counted below) and the automated test run.
 *
 * Needs pptxgenjs, react, react-dom, react-icons and sharp. They aren't part of the app, so install
 * them in any folder and point NODE_PATH at it:
 *     npm install pptxgenjs@3.12.0 react@18.3.1 react-dom@18.3.1 react-icons@5.4.0 sharp@0.33.5
 *     NODE_PATH=<that folder>/node_modules node docs/slides/build.cjs
 * Screenshots in assets/ come from take-shots.cjs (the manual's screenshot setup, without markers).
 */
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const sharp = require('sharp');
const PptxGenJS = require('pptxgenjs');
const fa = require('react-icons/fa6');

const HERE = __dirname;
const ROOT = path.join(HERE, '..', '..');
const ASSET = (name) => path.join(HERE, 'assets', name);
const OUTPUT = path.join(HERE, '..', 'Tuklas Presentation.pptx');

// Test figures. Automated: `php artisan test` on 2026-11-04. QA: every check counted as passed for
// now (the user's decision, 2026-11-04); replace with the testers' results when they're in.
const AUTOMATED = { tests: 223, passed: 223, assertions: 1433 };
const QA_FAILED = {}; // area number -> failed checks, e.g. { 5: 2 }

// Tuklas's own colors: the app's purple and the logo's yellow
const C = {
  ink: '1E1A2E', deep: '2E1F5E', title: '3B2A6B', purple: '6C4AB6', lilac: '8E7CC3',
  tint: 'F3F0FA', paper: 'FFFFFF', yellow: 'FDC95A', yellowSoft: 'FFF4D6', muted: '5A5A6E',
  line: 'DDD6EE', green: '2F8F5B', greenSoft: 'E3F3EA', red: 'C2410C', redSoft: 'FBE7DD',
};
const HEAD = 'Cambria';
const BODY = 'Calibri';
const W = 13.333;
const M = 0.6; // side margin

const pres = new PptxGenJS();
pres.layout = 'LAYOUT_WIDE';
pres.title = 'Tuklas: From Defense to Discovery';
pres.author = 'Manla, Limbadan, Rollon, Dumangas';
pres.theme = { headFontFace: HEAD, bodyFontFace: BODY };

const footer = { text: { text: 'Tuklas · From Defense to Discovery', options: { x: M, y: 7.0, w: 6, h: 0.3, fontFace: BODY, fontSize: 10, color: C.muted, margin: 0 } } };
pres.defineSlideMaster({
  title: 'CONTENT',
  background: { color: C.paper },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.4, w: W - 2 * M, h: 0.85, fontFace: HEAD, fontSize: 34, bold: true, color: C.title, valign: 'middle', margin: 0 }, text: '' } },
    footer,
  ],
  slideNumber: { x: W - M - 0.6, y: 7.0, w: 0.6, h: 0.3, fontFace: BODY, fontSize: 10, color: C.muted, align: 'right' },
});
pres.defineSlideMaster({ title: 'DARK', background: { color: C.deep }, objects: [] });

// ---------- helpers ----------

const iconCache = new Map();
async function icon(name, color) {
  const key = name + color;
  if (!iconCache.has(key)) {
    const svg = renderToStaticMarkup(React.createElement(fa[name], { size: 256, color: '#' + color }));
    const png = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
    iconCache.set(key, 'image/png;base64,' + png.toString('base64'));
  }
  return iconCache.get(key);
}

/** The deck's motif: a yellow rounded tile, like the Tuklas logo, holding an icon or a letter. */
async function tile(slide, x, y, size, { iconName, letter, fill = C.yellow, color = C.ink, name = 'tile' }) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: size, h: size, rectRadius: size * 0.22, fill: { color: fill }, line: { color: fill }, objectName: name });
  if (iconName) {
    const pad = size * 0.25;
    slide.addImage({ data: await icon(iconName, color), x: x + pad, y: y + pad, w: size - 2 * pad, h: size - 2 * pad, altText: name });
  } else {
    slide.addText(letter, { x, y, w: size, h: size, align: 'center', valign: 'middle', fontFace: HEAD, fontSize: Math.round(size * 40), bold: true, color, margin: 0, isTextBox: true });
  }
}

function card(slide, x, y, w, h, fill = C.tint, name = 'card') {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill }, objectName: name });
}

function text(slide, value, opts) {
  slide.addText(value, { fontFace: BODY, fontSize: 15, color: C.ink, margin: 0, valign: 'top', isTextBox: true, ...opts });
}

function bullets(items, size = 15) {
  return items.map((item, i) => ({ text: item, options: { bullet: { indent: 18 }, breakLine: i < items.length - 1, paraSpaceAfter: 8, fontSize: size } }));
}

function content(title, section) {
  const slide = pres.addSlide({ masterName: 'CONTENT', sectionTitle: section });
  slide.addText(title, { placeholder: 'title' });
  return slide;
}

function shadow() {
  return { type: 'outer', blur: 8, offset: 3, angle: 90, color: '000000', opacity: 0.18 };
}

function screenshot(slide, file, x, y, w, h, caption) {
  slide.addImage({ path: ASSET(file), x, y, w, h, altText: caption, shadow: shadow() });
  text(slide, caption, { x, y: y + h + 0.12, w, h: 0.35, fontSize: 12, color: C.muted, italic: true });
}

/** Checks per area of the QA checklist, from docs/qa/checklist.md. */
function qaAreas() {
  const areas = [];
  for (const line of fs.readFileSync(path.join(ROOT, 'docs', 'qa', 'checklist.md'), 'utf8').split(/\r?\n/)) {
    const heading = line.match(/^## (\d+)\. (.+)$/);
    if (heading) areas.push({ number: Number(heading[1]), name: heading[2], checks: 0 });
    else if (areas.length && line.startsWith('- ')) areas[areas.length - 1].checks += 1;
  }
  return areas;
}

// ---------- slides ----------

async function titleSlide() {
  pres.addSection({ title: 'Opening' });
  const slide = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Opening' });
  slide.addImage({ path: path.join(ROOT, 'tuklas', 'client', 'public', 'icons', 'icon-512.png'), x: M + 0.1, y: 1.2, w: 1.2, h: 1.2, altText: 'Tuklas logo' });
  text(slide, 'Tuklas', { x: M + 0.1, y: 2.65, w: 6.2, h: 1.1, fontFace: HEAD, fontSize: 60, bold: true, color: C.paper });
  text(slide, 'From Defense to Discovery', { x: M + 0.1, y: 3.75, w: 6.2, h: 0.6, fontFace: HEAD, fontSize: 26, italic: true, color: C.yellow });
  text(slide, 'A research and academic engagement hub for students, educators and school research offices', { x: M + 0.1, y: 4.5, w: 5.9, h: 0.9, fontSize: 18, color: 'D9D2EE' });
  text(slide, [
    { text: 'Prepared by', options: { bold: true, color: C.yellow, breakLine: true } },
    { text: 'Manla, Jun Mari · Limbadan, Benz Ashley · Rollon, Thirbby Andrei · Dumangas, Lian', options: { color: C.paper } },
  ], { x: M + 0.1, y: 5.95, w: 6.6, h: 0.75, fontSize: 14 });
  slide.addImage({ path: ASSET('shot-work.png'), x: 7.25, y: 1.45, w: 5.5, h: 3.44, altText: 'A published student work on Tuklas', shadow: shadow() });
  text(slide, 'A student’s research, approved by her adviser and open to everyone', { x: 7.25, y: 5.02, w: 5.5, h: 0.4, fontSize: 12, italic: true, color: 'D9D2EE' });
  slide.addNotes('Tuklas means "discover" in Filipino. It is a website where students’ research, once their adviser approves it, can be found, read and cited by anyone.');
}

async function backgroundSlide() {
  pres.addSection({ title: 'Company Background' });
  const slide = content('Company Background', 'Company Background');
  card(slide, M, 1.5, 4.3, 5.25, C.tint, 'profile card');
  slide.addImage({ path: ASSET('bucog.png'), x: M + 1.15, y: 1.8, w: 2.0, h: 2.0, rounding: true, altText: 'Bamie D. Bucog' });
  text(slide, 'Bamie D. Bucog, MAEd', { x: M + 0.25, y: 3.95, w: 3.8, h: 0.5, fontFace: HEAD, fontSize: 21, bold: true, color: C.title, align: 'center' });
  text(slide, 'Our client', { x: M + 0.25, y: 4.45, w: 3.8, h: 0.35, fontSize: 13, color: C.purple, bold: true, align: 'center' });
  text(slide, bullets([
    'Senior High School educator and researcher',
    'Part-time college instructor',
    'Doctor of Philosophy in Educational Management student, Holy Cross of Davao College',
  ], 14), { x: M + 0.3, y: 4.95, w: 3.75, h: 1.75 });

  const x = 5.35;
  const w = W - M - x;
  text(slide, 'Who he is', { x, y: 1.5, w, h: 0.4, fontFace: HEAD, fontSize: 20, bold: true, color: C.title });
  text(slide, 'A Senior High School educator, researcher and part-time college instructor. He holds a Master of Arts in Education and is pursuing a Doctor of Philosophy in Educational Management at Holy Cross of Davao College.', { x, y: 1.95, w, h: 1.0, fontSize: 16 });

  text(slide, 'Interests', { x, y: 3.1, w, h: 0.4, fontFace: HEAD, fontSize: 20, bold: true, color: C.title });
  const chips = ['Education', 'Student development', 'Sports performance', 'Educational management'];
  const chipW = (w - 0.2) / 2;
  chips.forEach((chip, i) => {
    const cx = x + (i % 2) * (chipW + 0.2);
    const cy = 3.55 + Math.floor(i / 2) * 0.58;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: cy, w: chipW, h: 0.46, rectRadius: 0.23, fill: { color: C.yellowSoft }, line: { color: C.yellow }, objectName: 'interest' });
    text(slide, chip, { x: cx, y: cy, w: chipW, h: 0.46, fontSize: 14, align: 'center', valign: 'middle', bold: true });
  });

  card(slide, x, 4.85, w, 1.05, C.tint, 'commitment');
  await tile(slide, x + 0.25, 5.03, 0.7, { iconName: 'FaQuoteLeft', name: 'quote icon' });
  text(slide, 'Committed to advancing knowledge through research, teaching and community engagement, while contributing to evidence-based educational practices.', { x: x + 1.15, y: 4.9, w: w - 1.35, h: 0.95, fontSize: 15, italic: true, valign: 'middle' });

  text(slide, [
    { text: 'His concern: ', options: { bold: true, color: C.purple } },
    { text: 'Senior High School students write research papers that rarely reach anyone beyond their defense panel.' },
  ], { x, y: 6.05, w, h: 0.7, fontSize: 16 });
  slide.addNotes('Our client, Sir Bamie Bucog, teaches and advises research in Senior High School and teaches part-time in college. He is taking his PhD in Educational Management at Holy Cross of Davao College. The problem he brought to us: students do real research, but almost nobody ever reads it.');
}

async function situationSlide() {
  pres.addSection({ title: 'Problems Encountered' });
  const slide = content('Where Student Research Ends Today', 'Problems Encountered');
  const steps = [
    ['FaBookOpen', 'Practical Research', 'Grades 11 and 12: students write a research paper.'],
    ['FaPersonChalkboard', 'Defense', 'A panel of teachers reads it once.'],
    ['FaBoxArchive', 'Bound copy', 'A hardbound copy goes to the library shelf.'],
    ['FaEyeSlash', 'Forgotten', 'The next batch can’t find it, so topics repeat.'],
  ];
  const cw = 2.75;
  const gap = (W - 2 * M - 4 * cw) / 3;
  for (const [i, [iconName, head, body]] of steps.entries()) {
    const x = M + i * (cw + gap);
    const last = i === steps.length - 1;
    card(slide, x, 1.55, cw, 2.55, last ? C.redSoft : C.tint, 'step');
    await tile(slide, x + 0.25, 1.8, 0.75, { iconName, fill: last ? C.red : C.yellow, color: last ? C.paper : C.ink, name: head });
    text(slide, head, { x: x + 0.25, y: 2.7, w: cw - 0.5, h: 0.45, fontFace: HEAD, fontSize: 19, bold: true, color: last ? C.red : C.title });
    text(slide, body, { x: x + 0.25, y: 3.15, w: cw - 0.5, h: 0.85, fontSize: 15 });
    if (!last) slide.addShape(pres.shapes.LINE, { x: x + cw + 0.06, y: 2.83, w: gap - 0.12, h: 0, line: { color: C.purple, width: 2, endArrowType: 'triangle' } });
  }

  const half = (W - 2 * M - 0.4) / 2;
  card(slide, M, 4.5, half, 2.2, C.yellowSoft, 'publishing');
  text(slide, 'The other road: publishing', { x: M + 0.3, y: 4.7, w: half - 0.6, h: 0.45, fontFace: HEAD, fontSize: 19, bold: true, color: C.title });
  text(slide, 'Journals and research congresses take months, cost money and have few slots for students. Most students never try.', { x: M + 0.3, y: 5.2, w: half - 0.6, h: 1.3, fontSize: 16 });
  const x2 = M + half + 0.4;
  card(slide, x2, 4.5, half, 2.2, C.tint, 'guidelines');
  text(slide, 'DepEd’s Research Management Guidelines', { x: x2 + 0.3, y: 4.7, w: half - 0.6, h: 0.45, fontFace: HEAD, fontSize: 19, bold: true, color: C.title });
  text(slide, 'DepEd Order No. 16, s. 2017 calls for research to be shared and used. Schools have no channel to share their students’ work.', { x: x2 + 0.3, y: 5.2, w: half - 0.6, h: 1.3, fontSize: 16 });
  slide.addNotes('This is the usual life of a Senior High School research paper. The work is real, but after the defense it sits on a shelf. The formal road to an audience, a journal or a research congress, is long and costly, so few students take it.');
}

async function piecesSlide(pair, part) {
  const slide = content('Problems Encountered (PIECES)', 'Problems Encountered');
  text(slide, `${part} of 3`, { x: W - M - 2, y: 1.25, w: 2, h: 0.3, fontSize: 12, color: C.muted, align: 'right' });
  const colW = (W - 2 * M - 0.5) / 2;
  for (const [i, p] of pair.entries()) {
    const x = M + i * (colW + 0.5);
    card(slide, x, 1.6, colW, 5.1, C.tint, p.word);
    await tile(slide, x + 0.35, 1.9, 1.05, { letter: p.letter, name: p.word });
    text(slide, p.word, { x: x + 1.65, y: 1.95, w: colW - 2, h: 0.55, fontFace: HEAD, fontSize: 26, bold: true, color: C.title });
    text(slide, p.lead, { x: x + 1.65, y: 2.5, w: colW - 2, h: 0.4, fontSize: 14, color: C.purple, italic: true });
    text(slide, bullets(p.problems, 16), { x: x + 0.4, y: 3.25, w: colW - 0.8, h: 3.3 });
  }
  slide.addNotes(pair.map((p) => `${p.word}: ${p.problems.join(' ')}`).join('\n\n'));
}

const PIECES = [
  { letter: 'P', word: 'Performance', lead: 'How long it takes to reach an audience', problems: [
    'Journal review takes months, and research congresses have few slots, so most papers are never presented.',
    'Advisers handle many research groups at once; feedback is slow and scattered.',
  ] },
  { letter: 'I', word: 'Information', lead: 'Whether research can be found and counted', problems: [
    'Finished papers become bound copies in the library: hard to find, read only on site, lost when the batch graduates.',
    'Students repeat topics because they can’t see what earlier batches did.',
    'The research office can’t count its research output for reports and accreditation.',
  ] },
  { letter: 'E', word: 'Economics', lead: 'What sharing research costs', problems: [
    'Printing and binding copies, journal publication fees and travel to congresses cost students money.',
    'Most schools can’t afford their own research repository or the staff to run it.',
  ] },
  { letter: 'C', word: 'Control', lead: 'Quality, ownership and privacy', problems: [
    'Posting research on social media has no quality check and no record of who wrote it first.',
    'No one is accountable for plagiarism or harmful content.',
    'Students, most of them minors, expose personal data when they post online.',
  ] },
  { letter: 'E', word: 'Efficiency', lead: 'How the work gets done', problems: [
    'Revisions travel by Messenger, email and printouts; versions get lost, and fixed comments are hard to track.',
    'Group work and deadlines live in group chats: files get buried, and late submissions go unnoticed.',
    'Research events are announced and registered for on paper.',
  ] },
  { letter: 'S', word: 'Service', lead: 'What students and readers get', problems: [
    'Students get little recognition; their research has no audience outside the panel.',
    'Student work can’t be found by search engines or cited properly.',
    'Students mostly have phones and slow connections, not computers.',
  ] },
];

async function solutionSlide() {
  pres.addSection({ title: 'The Solution' });
  const slide = content('The Solution: Tuklas', 'The Solution');
  card(slide, M, 1.55, 4.6, 5.15, C.deep, 'statement');
  text(slide, 'Tuklas gives student research a public home.', { x: M + 0.4, y: 1.9, w: 3.8, h: 1.6, fontFace: HEAD, fontSize: 28, bold: true, color: C.paper });
  text(slide, 'Advisers approve it, the school keeps it, and anyone can find, read and cite it, on a computer or a phone.', { x: M + 0.4, y: 3.65, w: 3.8, h: 1.6, fontSize: 18, color: 'D9D2EE' });
  text(slide, 'Open-source, multi-school, free to use', { x: M + 0.4, y: 5.95, w: 3.8, h: 0.4, fontSize: 14, bold: true, color: C.yellow });

  const users = [
    ['FaGlobe', 'Visitors', 'Read and cite approved research, no account needed'],
    ['FaUserGraduate', 'Students', 'Build a portfolio, submit works, join research groups'],
    ['FaChalkboardUser', 'Educators', 'Review and approve works, run groups, publish their own research'],
    ['FaBuildingColumns', 'Admins (research office)', 'Verify educators, approve events, moderate content'],
    ['FaUserShield', 'Super-admins', 'Run several schools on one site'],
  ];
  const x = M + 5.0;
  for (const [i, [iconName, who, what]] of users.entries()) {
    const y = 1.6 + i * 1.03;
    await tile(slide, x, y, 0.8, { iconName, name: who });
    text(slide, who, { x: x + 1.05, y: y + 0.02, w: 6, h: 0.4, fontFace: HEAD, fontSize: 19, bold: true, color: C.title });
    text(slide, what, { x: x + 1.05, y: y + 0.42, w: 6.4, h: 0.4, fontSize: 15 });
  }
  slide.addNotes('Tuklas is a website, also installable as an app. It has five kinds of users. Visitors need no account. Students and educators sign in with their school email. Each school’s research office runs its part of the site.');
}

async function answersSlide() {
  const slide = content('How Tuklas Answers PIECES', 'The Solution');
  const fixes = [
    ['P', 'Performance', 'Public as soon as the adviser approves: no months-long wait. One review board per adviser.'],
    ['I', 'Information', 'A searchable library and portfolios; similar works shown while typing keywords; statistics for the research office.'],
    ['E', 'Economics', 'Free to read and publish, built on open-source software; one site shared by several schools.'],
    ['C', 'Control', 'Nothing goes public without approval; every version is kept; reports, moderation and an audit log.'],
    ['E', 'Efficiency', 'Revision checklists and version history; research groups with deadlines and hand-ins; online event registration.'],
    ['S', 'Service', 'Google Scholar tags and APA and MLA citations; works on phones and installs like an app.'],
  ];
  const cw = (W - 2 * M - 0.6) / 3;
  const ch = 2.45;
  for (const [i, [letter, word, fix]] of fixes.entries()) {
    const x = M + (i % 3) * (cw + 0.3);
    const y = 1.55 + Math.floor(i / 3) * (ch + 0.3);
    card(slide, x, y, cw, ch, C.tint, word);
    await tile(slide, x + 0.3, y + 0.3, 0.75, { letter, name: word });
    text(slide, word, { x: x + 1.25, y: y + 0.42, w: cw - 1.5, h: 0.5, fontFace: HEAD, fontSize: 20, bold: true, color: C.title });
    text(slide, fix, { x: x + 0.3, y: y + 1.2, w: cw - 0.6, h: 1.15, fontSize: 15 });
  }
  slide.addNotes('Each problem area has a direct answer in the system. The next slides show the core workflow and the main features.');
}

async function workflowSlide() {
  const slide = content('From Draft to Discovery', 'The Solution');
  const box = (x, y, w, label, who, fill, color = C.ink) => {
    text(slide, who, { x, y: y - 0.38, w, h: 0.3, fontSize: 12, color: C.muted, align: 'center' });
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.85, rectRadius: 0.14, fill: { color: fill }, line: { color: fill }, objectName: label });
    text(slide, label, { x, y, w, h: 0.85, fontFace: HEAD, fontSize: 18, bold: true, color, align: 'center', valign: 'middle' });
  };
  const arrow = (x, y, w, h, opts = {}) => slide.addShape(pres.shapes.LINE, { x, y, w, h, line: { color: C.purple, width: 2, endArrowType: 'triangle' }, ...opts });
  const label = (value, x, y, w) => text(slide, value, { x, y, w, h: 0.3, fontSize: 12, italic: true, color: C.purple, align: 'center' });

  const y = 2.05;
  const bw = 2.35;
  const xs = [M, 3.45, 6.3, 9.45];
  box(xs[0], y, bw, 'Draft', 'Student', C.tint);
  box(xs[1], y, bw, 'Submitted', 'Student', C.tint);
  box(xs[2], y, bw, 'Under review', 'Adviser', C.tint);
  box(xs[3], y, W - M - xs[3], 'Approved & public', 'Adviser or academic panel', C.green, C.paper);
  arrow(xs[0] + bw + 0.05, y + 0.42, xs[1] - xs[0] - bw - 0.1, 0);
  arrow(xs[1] + bw + 0.05, y + 0.42, xs[2] - xs[1] - bw - 0.1, 0);
  arrow(xs[2] + bw + 0.05, y + 0.42, xs[3] - xs[2] - bw - 0.1, 0);

  const y2 = 4.15;
  box(xs[2], y2, bw, 'Needs revision', '', C.yellowSoft);
  box(xs[3], y2, W - M - xs[3], 'Rejected (final)', '', C.redSoft, C.red);
  const side = (value, x, yy, w, align) => text(slide, value, { x, y: yy, w, h: 0.5, fontSize: 12, italic: true, color: C.purple, align });
  // Under review -> Needs revision, straight down
  arrow(xs[2] + bw / 2, y + 0.9, 0, y2 - y - 0.95);
  side('returned with\na checklist', xs[2] + bw / 2 - 1.7, 3.25, 1.55, 'right');
  // Needs revision -> Submitted: drawn from Submitted's foot with the arrowhead at that end
  slide.addShape(pres.shapes.LINE, { x: xs[1] + bw / 2, y: y + 0.9, w: xs[2] - xs[1] - bw / 2 - 0.05, h: y2 + 0.42 - y - 0.9, line: { color: C.purple, width: 2, beginArrowType: 'triangle' } });
  side('revise &\nresubmit', xs[1] + 0.1, 3.75, 1.0, 'right');
  // Under review -> Rejected
  arrow(xs[2] + bw + 0.05, y + 0.8, xs[3] - xs[2] - bw + 0.25, y2 - y - 0.85);
  side('rejected', xs[3] - 0.15, 3.1, 1.2, 'left');

  const facts = [
    ['FaClockRotateLeft', 'Every version kept', 'Each resubmission is saved with its review history.'],
    ['FaLock', 'Private until approved', 'Only the authors, adviser and Admins see it before then.'],
    ['FaUserCheck', 'Approver on record', 'The public page names who approved the work and when.'],
  ];
  const fw = (W - 2 * M - 0.6) / 3;
  for (const [i, [iconName, head, body]] of facts.entries()) {
    const x = M + i * (fw + 0.3);
    await tile(slide, x, 5.45, 0.7, { iconName, name: head });
    text(slide, head, { x: x + 0.9, y: 5.42, w: fw - 0.9, h: 0.4, fontFace: HEAD, fontSize: 17, bold: true, color: C.title });
    text(slide, body, { x: x + 0.9, y: 5.82, w: fw - 0.9, h: 0.75, fontSize: 14 });
  }
  slide.addNotes('This is the core rule from our client: a student’s work becomes public only after the research adviser, or the school’s academic panel, approves it. The adviser can return it with a checklist of fixes; the student revises and resubmits; every version is kept. The full state diagram is Figure 7 of the SRS.');
}

async function featuresSlide() {
  const slide = content('Key Features', 'The Solution');
  const features = [
    ['FaIdCard', 'Portfolios', 'A public academic page for every member, with verified honors.'],
    ['FaFileCircleCheck', 'Adviser review', 'Submit, review, revise and approve, with every version kept.'],
    ['FaMagnifyingGlass', 'Library and citations', 'Search and filter research; APA 7 and MLA 9 in one click.'],
    ['FaUsers', 'Research groups', 'Channels, files, deadlines and deliverables with feedback.'],
    ['FaComments', 'Chat', 'Direct and group messages, live, stored encrypted.'],
    ['FaCalendarDays', 'Events', 'Academic events with registration; mentorships and grants.'],
    ['FaBullhorn', 'Announcements', 'To a school, department or group; alerts in the app, by email or push.'],
    ['FaFlag', 'Moderation', 'Reports, removal, warnings and an audit log.'],
    ['FaSchool', 'Several schools', 'One site; each school’s research office runs its own part.'],
  ];
  const cw = (W - 2 * M - 0.6) / 3;
  const ch = 1.6;
  for (const [i, [iconName, head, body]] of features.entries()) {
    const x = M + (i % 3) * (cw + 0.3);
    const y = 1.5 + Math.floor(i / 3) * (ch + 0.2);
    card(slide, x, y, cw, ch, C.tint, head);
    await tile(slide, x + 0.25, y + 0.25, 0.7, { iconName, name: head });
    text(slide, head, { x: x + 1.15, y: y + 0.25, w: cw - 1.35, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: C.title });
    text(slide, body, { x: x + 1.15, y: y + 0.68, w: cw - 1.35, h: 0.8, fontSize: 14 });
  }
  slide.addNotes('Twelve feature areas are specified in Section 4 of the SRS, with 87 functional requirements. These nine are the ones users see most.');
}

function lookStudentsSlide() {
  const slide = content('A Look Inside: Students', 'The Solution');
  screenshot(slide, 'shot-feed.png', M, 1.5, 8.0, 5.0, 'The community feed: approved works, opportunities and events, with filters');
  screenshot(slide, 'shot-phone-feed.png', 9.35, 1.5, 2.31, 5.0, 'The same feed on a phone');
  slide.addNotes('Students land on the community feed. Everything here has been approved. The same site works on a phone and can be installed like an app.');
}

function lookStaffSlide() {
  const slide = content('A Look Inside: Educators and the Research Office', 'The Solution');
  const w = (W - 2 * M - 0.4) / 2;
  screenshot(slide, 'shot-review-board.png', M, 1.6, w, w / 1.6, 'An adviser’s review board: awaiting review, under review, needs revision, approved');
  screenshot(slide, 'shot-admin.png', M + w + 0.4, 1.6, w, w / 1.6, 'The research office’s approval queue, with the school’s statistics');
  slide.addNotes('Advisers see every work they handle on one board. The research office verifies educators, approves events and handles reports from its approval queue.');
}

async function architectureSlide() {
  pres.addSection({ title: 'How It Is Built' });
  const slide = content('System Architecture', 'How It Is Built');
  const w = 7.4;
  slide.addImage({ path: path.join(ROOT, 'docs', 'srs', 'diagrams', 'deployment.png'), x: M, y: 1.55, w, h: w * 1793 / 3231, altText: 'UML deployment diagram of Tuklas' });
  text(slide, 'UML deployment diagram (SRS Figure 1)', { x: M, y: 1.65 + w * 1793 / 3231, w, h: 0.35, fontSize: 12, italic: true, color: C.muted });
  const stack = [
    ['FaServer', 'Laravel 13 on PHP 8.4', 'The server and its API'],
    ['FaLaptopCode', 'React 19', 'The web app, installable on phones'],
    ['FaDatabase', 'MySQL 8.4', 'The database'],
    ['FaBell', 'Laravel Reverb and Web Push', 'Live updates and notifications'],
    ['FaGears', 'Nginx on Ubuntu, Azure', 'The server, with nightly encrypted backups'],
  ];
  const x = M + w + 0.45;
  for (const [i, [iconName, head, body]] of stack.entries()) {
    const y = 1.55 + i * 1.0;
    await tile(slide, x, y, 0.7, { iconName, name: head });
    text(slide, head, { x: x + 0.9, y: y - 0.02, w: W - M - x - 0.9, h: 0.38, fontFace: HEAD, fontSize: 17, bold: true, color: C.title });
    text(slide, body, { x: x + 0.9, y: y + 0.36, w: W - M - x - 0.9, h: 0.38, fontSize: 14 });
  }
  slide.addNotes('One server runs everything: the web server, the Laravel application, the real-time server, the queue worker and the database. Browsers talk to it over HTTPS and an encrypted WebSocket. Emails go out through an email provider, and backups are copied off the server.');
}

async function securitySlide() {
  const slide = content('Security and Data Privacy', 'How It Is Built');
  const items = [
    ['FaScaleBalanced', 'Data Privacy Act', 'RA 10173: consent at sign-up; members can download their data and delete their account.'],
    ['FaKey', 'Two-factor sign-in', 'Required for Educators and Admins, optional for Students.'],
    ['FaLock', 'Encryption', 'HTTPS everywhere; chat, comments and review notes stored encrypted (AES-256).'],
    ['FaSchool', 'Each school’s data', 'Admins act only for their school; hidden items answer “not found”.'],
    ['FaUserLock', 'Strong passwords', 'At least 12 characters, checked against known breaches, hashed with Argon2id.'],
    ['FaShieldHalved', 'Built to a standard', 'Requirements follow OWASP ASVS 4.0.3 Level 2 and the OWASP Top 10.'],
  ];
  const cw = (W - 2 * M - 0.6) / 3;
  const ch = 2.4;
  for (const [i, [iconName, head, body]] of items.entries()) {
    const x = M + (i % 3) * (cw + 0.3);
    const y = 1.55 + Math.floor(i / 3) * (ch + 0.3);
    card(slide, x, y, cw, ch, C.tint, head);
    await tile(slide, x + 0.3, y + 0.3, 0.75, { iconName, name: head });
    text(slide, head, { x: x + 0.3, y: y + 1.2, w: cw - 0.6, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: C.title });
    text(slide, body, { x: x + 0.3, y: y + 1.6, w: cw - 0.6, h: 0.75, fontSize: 14 });
  }
  slide.addNotes('Tuklas holds students’ personal data, and many Senior High School students are minors, so privacy was a requirement from the start. Section 5.3 of the SRS lists all 17 security requirements.');
}

async function automatedResultsSlide() {
  pres.addSection({ title: 'Test Results' });
  const slide = content('Test Results: Automated Tests', 'Test Results');
  card(slide, M, 1.55, 5.0, 5.15, C.deep, 'automated stat');
  text(slide, `${AUTOMATED.passed} / ${AUTOMATED.tests}`, { x: M + 0.4, y: 1.95, w: 4.2, h: 1.2, fontFace: HEAD, fontSize: 64, bold: true, color: C.yellow });
  text(slide, 'feature tests passed', { x: M + 0.4, y: 3.15, w: 4.2, h: 0.45, fontSize: 20, color: C.paper });
  text(slide, `${AUTOMATED.assertions.toLocaleString('en-US')} assertions`, { x: M + 0.4, y: 4.0, w: 4.2, h: 0.5, fontFace: HEAD, fontSize: 28, bold: true, color: C.paper });
  text(slide, 'Each test checks what a role may do, what is refused, and what stays hidden.', { x: M + 0.4, y: 4.65, w: 4.2, h: 1.0, fontSize: 15, color: 'D9D2EE' });

  const x = M + 5.45;
  text(slide, 'Checked on every change (GitHub Actions)', { x, y: 1.55, w: W - M - x, h: 0.45, fontFace: HEAD, fontSize: 20, bold: true, color: C.title });
  const checks = [
    ['FaVial', 'Feature tests', 'On MySQL 8, the database the server uses'],
    ['FaListCheck', 'Code style', 'Laravel Pint'],
    ['FaMagnifyingGlass', 'Static analysis', 'Larastan, level 5'],
    ['FaLaptopCode', 'Web app', 'Type check, lint and production build'],
    ['FaShieldHalved', 'Dependencies', 'Audited for known vulnerabilities (Composer and npm)'],
  ];
  for (const [i, [iconName, head, body]] of checks.entries()) {
    const y = 2.2 + i * 0.9;
    await tile(slide, x, y, 0.65, { iconName, name: head });
    text(slide, head, { x: x + 0.9, y: y - 0.02, w: 5.5, h: 0.36, fontFace: HEAD, fontSize: 17, bold: true, color: C.title });
    text(slide, body, { x: x + 0.9, y: y + 0.33, w: 5.9, h: 0.36, fontSize: 14 });
  }
  slide.addNotes(`The automated suite has ${AUTOMATED.tests} feature tests with ${AUTOMATED.assertions} assertions; all of them pass. They run on every change pushed to GitHub, together with code style, static analysis, the web app's checks and a vulnerability audit of the libraries we use.`);
}

function qaResultsSlide() {
  const slide = content('Test Results: QA Checklist', 'Test Results');
  const areas = qaAreas();
  const total = areas.reduce((sum, a) => sum + a.checks, 0);
  const failed = areas.reduce((sum, a) => sum + (QA_FAILED[a.number] ?? 0), 0);

  card(slide, M, 1.55, 3.6, 5.15, C.greenSoft, 'QA stat');
  text(slide, `${total - failed} / ${total}`, { x: M + 0.3, y: 1.95, w: 3.15, h: 0.9, fontFace: HEAD, fontSize: 44, bold: true, color: C.green });
  text(slide, 'checks passed', { x: M + 0.35, y: 2.9, w: 3.0, h: 0.45, fontSize: 20 });
  text(slide, [
    { text: `${areas.length} areas`, options: { bold: true, breakLine: true } },
    { text: 'every role, both demo schools, phone and computer', options: { breakLine: true } },
    { text: ' ', options: { breakLine: true } },
    { text: 'Tested by', options: { bold: true, breakLine: true } },
    { text: 'Dumangas, Lian (QA)' },
  ], { x: M + 0.35, y: 3.75, w: 2.95, h: 2.6, fontSize: 15 });

  const short = (name) => name.replace(/^Two schools.*/, 'Two schools').replace(/ \(.*\)$/, '').replace(/ and /g, ' & ');
  slide.addChart(pres.charts.BAR, [
    { name: 'Passed', labels: areas.map((a) => short(a.name)), values: areas.map((a) => a.checks - (QA_FAILED[a.number] ?? 0)) },
    { name: 'Failed', labels: areas.map((a) => short(a.name)), values: areas.map((a) => QA_FAILED[a.number] ?? 0) },
  ], {
    x: M + 3.9, y: 1.45, w: W - 2 * M - 3.9, h: 5.35, barDir: 'bar', barGrouping: 'stacked',
    chartColors: [C.green, C.red], catAxisOrientation: 'maxMin', catAxisLabelFontSize: 11, valAxisLabelFontSize: 10,
    catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt', catAxisLabelColor: C.ink, valAxisLabelColor: C.muted,
    valGridLine: { color: 'E6E1F2', size: 0.5 }, catGridLine: { style: 'none' }, valAxisHidden: true,
    showValue: true, dataLabelPosition: 'inEnd', dataLabelColor: C.paper, dataLabelFontSize: 10, dataLabelFontFace: '+mn-lt',
    dataLabelFormatCode: '0;;', // zeros (no failures) get no label
    showLegend: true, legendPos: 't', legendFontSize: 11, legendFontFace: '+mn-lt', barGapWidthPct: 45,
    showTitle: true, title: 'Checks per area', titleFontSize: 14, titleFontFace: '+mn-lt', titleColor: C.title,
  });
  slide.addNotes(`The QA checklist has ${total} checks in ${areas.length} areas, built from the requirements in the SRS. ${failed === 0 ? 'All checks passed.' : `${failed} failed and are being fixed.`}`);
}

async function futureSlide() {
  pres.addSection({ title: 'Closing' });
  const slide = content('Limitations and Future Enhancements', 'Closing');
  text(slide, 'Release 1.0 today', { x: M, y: 1.45, w: 5.4, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: C.muted });
  text(slide, 'Next', { x: M + 6.45, y: 1.45, w: 5.5, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: C.purple });
  const rows = [
    ['One named adviser approves each work', 'Blind review, with reviewers from another school'],
    ['Plagiarism is reported by members, not detected', 'Automatic plagiarism checking'],
    ['No parent or guardian consent step for minors', 'Guardian consent, as the Data Protection Officer advises'],
    ['Educators and Admins can’t move two-factor sign-in to a new phone', 'Moving two-factor sign-in to a new phone; passkey sign-in'],
    ['Runs on a student cloud server', 'A permanent production host and domain'],
  ];
  for (const [i, [now, next]] of rows.entries()) {
    const y = 1.95 + i * 0.95;
    card(slide, M, y, 5.6, 0.8, C.tint, 'limitation');
    text(slide, now, { x: M + 0.25, y, w: 5.1, h: 0.8, fontSize: 15, valign: 'middle' });
    slide.addShape(pres.shapes.LINE, { x: M + 5.72, y: y + 0.4, w: 0.6, h: 0, line: { color: C.purple, width: 2, endArrowType: 'triangle' } });
    card(slide, M + 6.45, y, W - 2 * M - 6.45, 0.8, C.yellowSoft, 'enhancement');
    text(slide, next, { x: M + 6.7, y, w: W - 2 * M - 6.95, h: 0.8, fontSize: 15, bold: true, valign: 'middle' });
  }
  slide.addNotes('These are the known limits of release 1.0 and what we plan next. For now each work is approved by a named adviser, which matches how Senior High School research is supervised; blind review is planned as an enhancement.');
}

async function teamSlide() {
  const slide = content('The Team', 'Closing');
  const team = [
    ['JM', 'Manla, Jun Mari', 'Developer', 'FaLaptopCode'],
    ['BL', 'Limbadan, Benz Ashley', 'Project Manager', 'FaRoute'],
    ['TR', 'Rollon, Thirbby Andrei', 'Documentation', 'FaBook'],
    ['LD', 'Dumangas, Lian', 'Quality Assurance', 'FaClipboardCheck'],
  ];
  const cw = (W - 2 * M - 0.9) / 4;
  for (const [i, [initials, name, role, iconName]] of team.entries()) {
    const x = M + i * (cw + 0.3);
    card(slide, x, 1.8, cw, 4.4, C.tint, name);
    slide.addShape(pres.shapes.OVAL, { x: x + (cw - 1.6) / 2, y: 2.2, w: 1.6, h: 1.6, fill: { color: C.purple }, line: { color: C.purple }, objectName: 'avatar' });
    text(slide, initials, { x: x + (cw - 1.6) / 2, y: 2.2, w: 1.6, h: 1.6, fontFace: HEAD, fontSize: 40, bold: true, color: C.paper, align: 'center', valign: 'middle' });
    text(slide, name, { x: x + 0.2, y: 4.1, w: cw - 0.4, h: 0.8, fontFace: HEAD, fontSize: 19, bold: true, color: C.title, align: 'center', valign: 'middle' });
    await tile(slide, x + (cw - 0.6) / 2, 5.0, 0.6, { iconName, name: role });
    text(slide, role, { x: x + 0.2, y: 5.65, w: cw - 0.4, h: 0.4, fontSize: 15, color: C.purple, bold: true, align: 'center' });
  }
  slide.addNotes('Jun Mari built the system, Benz Ashley managed the project, Thirbby Andrei wrote the documentation, and Lian ran quality assurance.');
}

function closingSlide() {
  const slide = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Closing' });
  slide.addImage({ path: path.join(ROOT, 'tuklas', 'client', 'public', 'icons', 'icon-512.png'), x: (W - 1.3) / 2, y: 1.5, w: 1.3, h: 1.3, altText: 'Tuklas logo' });
  text(slide, 'Thank you', { x: 1, y: 3.05, w: W - 2, h: 1.1, fontFace: HEAD, fontSize: 54, bold: true, color: C.paper, align: 'center' });
  text(slide, 'Questions and answers', { x: 1, y: 4.15, w: W - 2, h: 0.6, fontFace: HEAD, fontSize: 24, italic: true, color: C.yellow, align: 'center' });
  text(slide, 'Tuklas · From Defense to Discovery', { x: 1, y: 5.6, w: W - 2, h: 0.4, fontSize: 15, color: 'D9D2EE', align: 'center' });
}

(async () => {
  await titleSlide();
  await backgroundSlide();
  await situationSlide();
  await piecesSlide(PIECES.slice(0, 2), 1);
  await piecesSlide(PIECES.slice(2, 4), 2);
  await piecesSlide(PIECES.slice(4, 6), 3);
  await solutionSlide();
  await answersSlide();
  await workflowSlide();
  await featuresSlide();
  lookStudentsSlide();
  lookStaffSlide();
  await architectureSlide();
  await securitySlide();
  await automatedResultsSlide();
  qaResultsSlide();
  await futureSlide();
  await teamSlide();
  closingSlide();
  await pres.writeFile({ fileName: OUTPUT });
  console.log('Wrote', OUTPUT);
})().catch((error) => { console.error(error); process.exit(1); });
