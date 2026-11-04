# Feature inventory and review (2026-11-01)

What Tuklas does for each kind of user, how that compares with social media and research
publication sites, and which missing features the team decided to build. The build's status
for each planned feature is in [`docs/TODO.md`](../../docs/TODO.md) (section "Features").

## 1. What's built, by role

### Anyone, signed out
- Read public works and their PDFs, public publications, and public portfolios (`/u/<username>`)
  with photo and CV.
- Read the privacy notice.
- Sign up (with Data Privacy Act consent), log in, reset a forgotten password.

### Student
- **Account:** email verification; optional two-factor sign-in (2FA) with recovery codes; change
  password; see and sign out other sessions; export my data; delete my account (published work
  stays, credited to "Former member").
- **Portfolio:** headline, program and department; academic links (Google Scholar, ORCID,
  ResearchGate, LinkedIn, faculty page); education and experience; honors (awards, grants,
  certifications), verified by an admin; photo and CV.
- **Works** (research, literary, innovation):
  - Draft with abstract, tags, co-authors and a chosen adviser, plus a PDF.
  - A "similar works" check while drafting.
  - Submit for review, revise, keep earlier versions.
  - Defense stages (proposal, colloquium, final defense, revisions, published) with verdicts.
  - Public only after the adviser approves.
- **Engage:**
  - The feed: filter by type or department, search, sort by newest or most discussed.
  - React (Insightful, Useful, Inspiring), save to my Library, comment in the public discussion.
  - Cite (APA, MLA), share with a QR code.
- **Opportunities and events:** apply to mentorships, grants and calls for papers (and withdraw);
  register for events (and cancel).
- **Research groups:** group channels, shared files, deadlines, deliverable submissions
  (individual or one per group) with version history and notes.
- **Chat:**
  - Direct messages and channels, files, threaded replies, delete my own message.
  - Find chats by name, with All / Direct / Channels / Unread filters.
  - See who's online.
- **Updates:** announcements with an unread badge, live notifications, people search.

### Educator
An admin verifies educators, and can grant or remove three rights: *publish*, *moderate groups*,
*broadcast*. Educators have everything a student has, plus:
- **Review queue** for works where they're the adviser: start a review, comment on checklist
  items, ask for revisions, approve or reject. Record defense stages and verdicts.
- **Publications:** their own papers as draft, internal or public, with a PDF.
- **Opportunities, events and event ads:** post them; they wait for admin approval.
- **Groups:** create, add members (leader, member, mentor), channels, files, deadlines with
  instructions and a submission mode. Accept a deliverable or ask for a revision.
- **Announcements** to their department or a group, with attachments and read receipts.
- 2FA is required.

### Admin
- Dashboard statistics, and an approval queue for events and ads.
- Verify or decline honors.
- **People:** change roles, verify educators, turn each educator's rights on or off, see what
  educators have done lately.
- **Moderation:** remove and restore works, delete any chat message, manage any group.
- System-wide announcements; can review works.
- 2FA is required. Admins can't delete their own account.

## 2. Compared with social media and research sites

Social media: LinkedIn, Facebook. Research sites: ResearchGate, Academia.edu, Google Scholar,
university repositories.

| Feature | Social media | Research sites | Tuklas (2026-11-01) |
|---|---|---|---|
| Profile and portfolio | ✓ | ✓ | ✓ |
| Feed, reactions, comments | ✓ | ✓ | ✓ |
| Chat and groups | ✓ | Partly | ✓ (more: deadlines, submissions) |
| Review before publishing | ✗ | Repositories ✓ | ✓ |
| Report or flag content | ✓ | ✓ | ✗ |
| Follow people or topics | ✓ | ✓ | ✗ |
| @mentions | ✓ | Partly | ✗ |
| Notification settings, email digests | ✓ | ✓ | ✗ (in-app and live only) |
| View and download counts | ✓ | ✓ (core feature) | ✗ |
| Found by Google and Google Scholar | ✓ (link previews) | ✓ (core feature) | ✗ (the app page carries no per-paper details, so search engines and link previews see an empty page) |
| Advanced search and browse (year, department, adviser, type) | Partly | ✓ | Partly (type, department, text) |
| Citation export (BibTeX, RIS) and more styles (IEEE, Chicago) | ✗ | ✓ | Partly (APA, MLA) |
| License (e.g. Creative Commons) and embargo | ✗ | ✓ | ✗ |
| The researchers' own story (client Q&A 2a) | ✓ (posts) | Partly | ✗ |
| Edit messages, reactions, read receipts in chat | ✓ | ✗ | ✗ |
| Install on a phone, push notifications | ✓ (apps) | ✓ | ✗ |
| DOI, full-text search in PDFs, OAI-PMH repository feed | ✗ | ✓ | ✗ |

## 3. Decisions

Decided 2026-11-01. Each is a row in `docs/TODO.md`.

| # | Branch | What | Why |
|---|---|---|---|
| 1 | `feat/report-content` | Report a work, comment, message, event or person; an admin moderation queue (dismiss, remove, warn) | Every public social platform needs it; a safety gap |
| 2 | `feat/search-indexing` | Public work and publication pages carry their title, authors, abstract and PDF link for Google Scholar (`citation_*` tags) and link previews (Open Graph); a `sitemap.xml` | Discovery outside Tuklas; shared links show a proper preview |
| 3 | `feat/work-metrics` | View and download counts on works and publications; a "reach" panel for authors | Standard on research sites; motivates students |
| 4 | `feat/library-browse` | Filter and browse by year, program or department, adviser, type and tag | Finding past research is the core of a repository |
| 5 | `feat/research-story` | Optional "How we made this" section on a work | The client asked for personal quotes (Q&A 2a) |
| 6 | `feat/follow` | Follow people, departments and tags; a "Following" feed filter | Engagement, as on social media |
| 7 | `feat/notification-settings` | Choose which notifications also arrive by email; an optional weekly digest | People who don't open the app still hear about reviews and deadlines |
| 8 | `feat/mentions` | @mentions in discussions and chat, with a notification | Bring someone into a conversation |
| 9 | `feat/chat-polish` | Edit a message, react to it, see who has read it | What people expect from chat |
| 10 | `feat/pwa` | Install Tuklas on a phone; push notifications | Most students use phones |

**Not now:** citation export and more styles, a license and embargo on works (both worth doing
later). **Only if the university asks:** DOIs (they need a Crossref membership), an OAI-PMH feed
for repository harvesters, full-text search inside PDFs. **Not planned:** reposts, stories and
polls; Tuklas is academic, not general social media (client requirement 1).

## 4. Several schools on one site (2026-11-02)

The build assumes one university per Tuklas site (`docs/DEPLOYMENT.md`); the client's notes don't say
either way. Users from several schools on one site would break a few things: department
announcements reach every school with a department of the same name, the digest and library mix
schools, one set of admins handles every school, and Google Scholar gets one university name
(`TUKLAS_INSTITUTION`) for everyone.

Decided: if the client wants several schools on one site, build all of it: an institution for every
person (picked at signup, matched by email domain), departments, announcements, the digest and
browsing scoped to the institution, admins per institution with super-admins, and Google Scholar
using each author's own institution. Three rows in `docs/TODO.md` ("Future: several schools on one
site"), waiting on the client's answer. If the answer is one site per school, nothing changes and
each server sets `TUKLAS_INSTITUTION`.

**2026-11-04:** these come before real student data goes on any server (launch order in
`docs/TODO.md`, "Before real student data"): every account then carries its school from the start,
instead of real accounts being moved and re-checked afterwards.

**2026-11-04, answered:** several schools on one site, and research a school publishes can be read
from the others. The plan, who sees what, and the questions still open for the client are in
`docs/decisions/0002-several-schools-on-one-site.md`.
