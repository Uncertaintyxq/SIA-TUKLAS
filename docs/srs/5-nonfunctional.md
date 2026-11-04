# 5. Other Nonfunctional Requirements

## Performance Requirements

Tuklas serves one site of hundreds to a few thousand members (Section 2.7), on one server with 2 virtual CPUs and 1 GB of memory (Section 2.4). The requirements below are targets for that load. They have not yet been measured on the production server (TBD-8).

- **PERF-1, response time.** With 100 members active at once, 95% of API requests shall be answered within 1 second, and every screen shall show its content within 3 seconds on a 4G phone connection.
- **PERF-2, live updates.** A new chat message or notification shall reach the other members' open screens within 2 seconds of being sent.
- **PERF-3, background work.** Sending emails and push notifications shall never make a member wait: the request is answered first, and the queue worker sends them, normally within one minute.
- **PERF-4, lists.** Lists that grow without limit shall never load in full: the feed, library, notifications and admins' lists show a fixed number of the most recent or most relevant items, and chat history loads older messages only when the member scrolls back.
- **PERF-5, uploads.** The server shall accept files up to the limits in Section 3.4 (20 MB for a work's PDF), and refuse larger ones with a message that says the limit.
- **PERF-6, releases.** A new release shall take the site offline for no more than a few seconds: it is built in a separate folder and switched on in one step (Section 5.2).

To meet these targets, the server caches the application's configuration, routes and compiled PHP code (OPcache), the database has indexes for the lookups the screens make, and each screen loads the related records it needs together, instead of one query per item.

## Safety Requirements

Tuklas controls no physical equipment, so its safety requirements concern the loss or damage of data, and harm to the people who use it.

- **SAFE-1, backups.** The server shall back up the database and the uploaded files every night, encrypted with a public key whose private half is kept off the server. It shall keep the backups for 30 days, and copy them to storage on another site, so that losing the server doesn't lose the data.
- **SAFE-2, restore.** A restore from the off-server copy shall be tested before the first real data goes in, and after any change to the backup scripts.
- **SAFE-3, safe releases.** A release that fails to build shall leave the site running the previous release. The server shall take a backup before changing the database structure, and keep the last 5 releases so that the previous one can be switched back on.
- **SAFE-4, no demonstration data in production.** The application shall refuse to start in production with demonstration mode on, and the release script shall refuse to load demonstration data there.
- **SAFE-5, confirming destructive actions.** Deleting an account, rejecting a work, cancelling an event, deleting a group and moving a member to another school shall each ask for confirmation. Deleting an account shall also ask for the password.
- **SAFE-6, harm to people.** Members shall be able to report harassment, bullying and the sharing of private information (REQ-MOD-1), and Admins shall be able to remove such content at once. Content is limited to academic work, events and opportunities (Section 5.5).

## Security Requirements

Tuklas holds personal data of students and faculty, and unpublished research. It shall meet OWASP ASVS 4.0.3 at Level 2, avoid the OWASP Top 10 risks (References 11 and 12), and comply with the Data Privacy Act of 2012 (Reference 14).

**Authentication**

- **SEC-1.** Passwords shall be 12 to 128 characters, shall be checked against known breaches, and shall be stored hashed with Argon2id (NIST SP 800-63B).
- **SEC-2.** Educators and Admins shall use two-factor sign-in; Students may (REQ-ACC-5). A code shall work only once.
- **SEC-3.** Sign-in, two-factor codes and password resets shall be rate-limited (REQ-ACC-6), and the API shall limit each member's requests (Section 3.4).
- **SEC-4.** Sessions shall be stored on the server and carried in an encrypted, Secure, HttpOnly, SameSite=Lax cookie, protected by CSRF tokens. They shall end after 120 minutes without activity, and changing the password or two-factor settings shall need the password again.

**Access control**

- **SEC-5.** Every access rule shall be enforced on the server, in one place for each kind of record (a policy), never only in the user interface.
- **SEC-6.** A request for something the member may not see shall answer "404 Not Found", so that its existence isn't revealed. Each response shall contain only the fields that member may see.
- **SEC-7.** Admins shall act only for their own school (REQ-ADM-1), and Educators only as far as their rights allow (REQ-ADM-3).

**Data protection**

- **SEC-8.** All traffic shall use HTTPS, with HTTP Strict Transport Security, a Content Security Policy and the other headers in Section 3.4.
- **SEC-9.** Chat messages, comments, review comments, revision checklists and deliverable feedback shall be stored encrypted (AES-256). The application key that unlocks them shall be kept in the team's password manager, never in the source code; keys can be rotated without losing old data.
- **SEC-10.** Uploaded files shall be stored outside the web folder, checked for their real type, and served only after the member's access is checked.
- **SEC-11.** Personal data shall not be written to the logs.
- **SEC-12.** Moderation and administrative actions shall be recorded in an audit log (REQ-MOD-5).

**Privacy (RA 10173)**

- **SEC-13.** Members shall consent to the privacy notice at sign-up, and again when it changes (REQ-ACC-9).
- **SEC-14.** Members shall be able to get a copy of their data (REQ-ACC-10) and delete their account (REQ-ACC-11).
- **SEC-15.** Each school shall name a Data Protection Officer and sign a data processing agreement before its members' real data goes in (TBD-6).

**The server**

- **SEC-16.** The server's firewall shall allow only SSH, HTTP and HTTPS. SSH shall accept keys only, never passwords, and the database and the real-time server shall not be reachable from outside.
- **SEC-17.** Before launch, the "launch check" command shall pass, and the security checklist in docs/DEPLOYMENT.md shall be ticked, including an A grade on SSL Labs and securityheaders.com.

## Software Quality Attributes

In order of importance to the client and the team:

- **Correctness and security, over convenience.** The approval rule, access rules and privacy rights shall never be traded for a quicker way of doing something.
- **Testability.** Every change in behavior comes with an automated test of what is allowed, what is refused, and what is hidden. Release 1.0 has 223 automated feature tests, run on MySQL 8 on every change in GitHub Actions, together with the client checks.
- **Maintainability.** The code follows one structure per module (docs/ARCHITECTURE.md) and written conventions (docs/CONVENTIONS.md). Every change is checked for formatting (Laravel Pint), by static analysis (Larastan level 5), by type checking and linting of the user interface, and by a scan of the dependencies for known vulnerabilities.
- **Usability.** A first-time Student shall be able to sign up, complete their portfolio and submit a work by following the user manual alone, without help. Every screen uses plain English and asks for confirmation before anything that can't be undone.
- **Reliability.** The real-time server and the queue worker are restarted by Supervisor if they stop. If the real-time server is down, the site keeps working and members see changes when they reload.
- **Availability.** The site is meant to be available at all times. Release 1.0 runs on one server without a standby, so a server failure means restoring from the latest backup; a target for availability is set with the production host (TBD-1).
- **Portability.** The server uses only standard open-source software (Section 2.4), so it can move to any Linux host that runs Ubuntu, with the setup scripts in the repository.
- **Interoperability.** Public research carries Google Scholar citation tags and APA 7 and MLA 9 citations, so that other systems can find and cite it.

## Business Rules

These operating principles hold everywhere in Tuklas. The requirements in Section 4 enforce them.

- **BR-1.** A student's work becomes public only after its research adviser or the academic panel approves it.
- **BR-2.** Only a verified Educator reviews works. An Admin of the Educator's school verifies them, and switches each of their three rights (publishing, moderating groups, posting announcements) on or off.
- **BR-3.** Admin accounts are issued by the research office, never created by sign-up. Admins don't delete their own accounts.
- **BR-4.** Every member belongs to one school. An email address on the school's domain places them in it at once; anyone else waits for the school's Admins to confirm them.
- **BR-5.** Admins act for their own school only; Super-admins act for every school. There should always be at least two Super-admins.
- **BR-6.** Events and advertisements are academic only: research colloquiums, thesis defenses, research fairs, school innovations and the C.P. Garcia event. No commercial content. An Admin approves each event and ad.
- **BR-7.** A rejected work is final. A returned work changes only through "Revise & resubmit".
- **BR-8.** A work's review history and review thread are seen only by its authors, its adviser and the Admins.
- **BR-9.** In a research group, only Students (its leader and members) hand in deliverables, and only the adviser, mentors and Admins see all of them and give feedback.
- **BR-10.** A person who is reported is never told who reported them.
- **BR-11.** A deleted account becomes "Former member" wherever others' work depends on it; everything else that is personal is erased.
- **BR-12.** A notification about a mention goes only to someone who can see where they were mentioned. Only a group's organizers notify the whole group at once.
