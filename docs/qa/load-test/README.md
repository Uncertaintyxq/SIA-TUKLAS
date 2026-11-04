# Load test (TBD-8: PERF-1 to PERF-3)

Measures the performance requirements in SRS 5.1 on the live site, https://junmm.me. It takes
about 40 minutes, including about 12 minutes of load. Run it at a quiet hour, and never on a day
the site is being shown.

| File | Does |
|---|---|
| `members.js` | The k6 script: 100 members sign in and use the site at once (reads only) |
| `loadtest-accounts.php` | Makes the 100 test accounts on the server, and removes them afterwards |

Why test accounts: the site limits each account to 120 requests a minute, and everyone signed out
from one address together, so 100 people can only be imitated with 100 accounts.

## 1. Install k6 on your PC (once)

In PowerShell:
```powershell
winget install k6 --source winget
```
Close and reopen PowerShell, then check that `k6 version` prints a version.

## 2. Make the test accounts (on the server)

Copy the account script to the server, in PowerShell on your PC (from the repo folder):
```powershell
scp docs/qa/load-test/loadtest-accounts.php tuklas@junmm.me:~/
```
Then on the server (`ssh tuklas@junmm.me`):
```bash
cd /var/www/tuklas/current
php ~/loadtest-accounts.php create 100
```
It asks for a password for the test accounts: make up a new one (12+ characters), not the
showcase password. It prints "Ready: loadtest-001 to loadtest-100 …".

Stay logged in to the server, and start a second window to watch it during the test:
```bash
vmstat 5
```
It prints a line every 5 seconds. Note `free` (memory left, in KB), `si`/`so` (swapping: should
stay 0) and `id` (idle CPU %: near 0 means the CPU is full).

## 3. PERF-1: run the load test (on your PC)

In PowerShell, from the repo folder:
```powershell
k6 run -e LOADTEST_PASSWORD="the test accounts' password" --summary-export docs/qa/load-test/result.json docs/qa/load-test/members.js
```
- Minutes 0–6: members sign in, about 17 a minute (the site's sign-in limit is 20 a minute from one
  address).
- Minutes 6–11: all 100 are active. Only this part counts for PERF-1.
- Then it winds down and prints a summary.

**Reading the summary:**
- `http_req_duration{kind:read,phase:full}`: **p(95)** is PERF-1's number. Under 1 s (1000 ms) passes.
- `checks`: should be 99% or more. "not rate limited" failing means a limit was hit: send me the output.
- A green ✓ next to each threshold means it passed; a red ✗ means it didn't.
- Your connection adds about 60–100 ms to each request (the server is in Japan); that's realistic
  for people in the Philippines, so leave it in.

Do steps 4 and 5 while the test is in minutes 6–11.

## 4. PERF-2: live updates within 2 seconds (by hand, during the load)

1. On the PC, sign in as Andrea (`andrea@tu.junmm.me`) in one browser, and as Paolo
   (`paolo@tu.junmm.me`) in a private window. Put them side by side.
2. Open Messages in both, on their conversation (start one if there isn't any).
3. Send 5 messages from Andrea, one at a time. For each, count how long until it shows in Paolo's
   window. A phone's stopwatch is enough; better, record the screen and check the times after.
4. PERF-2 passes if every message shows within 2 seconds.

## 5. PERF-3: email doesn't make anyone wait (by hand, during the load)

1. In another private window, open https://junmm.me/forgot-password, and press F12 → **Network**.
2. Ask for a reset link for `kim@tu.junmm.me`.
3. In Network, the `forgot-password` request's **Time** should be well under 1 second: the email
   is queued, not sent while you wait.
4. Note when you pressed the button and when the email arrives in your Gmail. PERF-3 passes if it
   arrives within about a minute.

(Kim's password isn't changed unless someone uses the link.)

## 6. The 3-second screens (PERF-1, second half)

After the test, with no load: in Chrome, open https://junmm.me/works/1 in a private window, press
F12 → **Network** → set throttling to **Fast 4G** (or "Slow 4G" for a hard case) → reload. The
time at the bottom ("Load" or "Finish") is how long the screen takes. Do the same signed in as
Andrea for /feed. Under 3 seconds passes.

## 7. Clean up (the same day)

On the server:
```bash
cd /var/www/tuklas/current
php ~/loadtest-accounts.php delete
rm ~/loadtest-accounts.php
```
It removes the 100 accounts, their sessions and sign-in records, and takes back the views they
added to the showcase's works. Do it the same day: after midnight the views can't be told apart
any more.

## 8. Record the results

Send the summary from step 3 (or `result.json`), the `vmstat` notes, and your times from steps
4 to 6. They go into SRS 5.1 (removing TBD-8 from Appendix C), the QA checklist's last check, and
the slides' test results.

If PERF-1 fails, that's a finding, not a mistake: the server has 1 GB of memory. The `vmstat`
notes show whether memory or CPU ran out, which decides between recording what it achieves and
planning a larger server (`chore/production-host`).
