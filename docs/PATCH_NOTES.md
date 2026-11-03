# Tuklas patch notes

## Next update (not on staging yet)

Merged into `main` but not on <https://tuklas-sia-jm.japaneast.cloudapp.azure.com> until the next
`deploy.sh`.

### New for everyone

**How often research is read**
- Each public work and publication shows how many times it was **viewed** and its PDF
  **downloaded**: on the work page (under the reactions) and on the publication page.
- Portfolios show the total views and downloads of the person's own works and research.
- **My research** has a **Reach** panel: your totals and your most-read works.
- Each reader counts once a day, and your own visits don't count. The PDF shown inside the work
  page doesn't count as a download; opening or downloading the PDF does.
- Privacy: Tuklas doesn't keep who viewed what. To count each reader once a day it keeps a scrambled
  code for the day, never your IP address or browser, and deletes it the next day.

**"How we made this" on a work**
- Students can add a short story to a work, in their own words: how the idea started, what went
  wrong along the way, what they'd tell the next student. It's optional, written in the entry form
  next to the abstract.
- The panel reads it during review; everyone sees it on the work page once the work is approved.

**@mentions**
- Type **@** and a name in a discussion, a review thread or a chat to mention someone: a list of
  matching people appears (↑/↓ to choose, Enter or Tab to pick, Esc to close).
- The person mentioned gets a notification, and the mention links to their portfolio.
- Only people who can see the message are told: someone outside a private chat or review thread
  isn't. The notification says who mentioned you and where, not what they wrote.
- **@everyone** (or **@all**) in a group channel notifies everyone in the group. The adviser,
  mentors and the student leader can use it; for other members it's plain text.
- **Account and security → Notifications** has a new **Mentions** row: push is on and email is off
  to start with.

## Staging update 1 (November 2026)

Everything added since staging first went live at
<https://tuklas-sia-jm.japaneast.cloudapp.azure.com>. It reaches the site with the next server
update (`docs/STAGING_SERVER.md`, "One-time steps"); until then, staging runs the first version.

### New for everyone

**Install Tuklas as an app**
- On Android, and in Chrome or Edge on a computer: **Account and security → Notifications →
  Install Tuklas**. It opens like an app, straight to the feed.
- On iPhone and iPad: Share → **Add to Home Screen**.
- With no connection, pages show a "You're offline" screen instead of the browser's error.

**Notifications on your phone and by email**
- **Account and security → Notifications** has an **Email** and a **Push** switch for each kind of
  update:
  - your research and reviews
  - research groups
  - announcements
  - events and opportunities
  - your account
  - admins only: the approval queue
- **Turn on notifications here** sends updates to this phone or browser, even when Tuklas is
  closed. Tapping one opens the right page.
- An optional **weekly digest** email every Monday morning: updates you haven't read, this week's
  group deadlines and events, and new research from your department.
- Announcement emails now follow your email choice; before, everyone got them.
- On iPhone, push notifications need Tuklas on the home screen first (an Apple rule).

**Chat**
- **Edit** your own messages. They show "(edited)".
- **React** to messages with 👍 ❤️ 😂 🎉 🤔 🙏. Hover a reaction to see who reacted, and tap it
  again to take yours back.
- **"Seen" / "Seen by …"** under your latest message shows who has read it.
- Edits, reactions and "Seen" update live in the other person's window.

**Report a problem**
- A **Report** button on works, discussion comments, chat messages, events and people's
  portfolios. Pick a reason (plagiarism, harassment, spam, private information, …) and add a note
  if you like.
- You're told when an admin has looked at your report. The person you reported is never told who
  reported them.
- Reporting a private chat message shows that message to the admins; the report form says so
  before you send it.

**Found on Google**
- Public works, publications and portfolios now carry their title, authors, abstract and PDF link
  in a form Google Scholar and search engines read.
- Shared links now show a proper preview in Messenger, Facebook and other apps.
- Browser tabs show the page's title, for example "Flood Alert Mesh… · Tuklas".
- Drafts, works in review, removed works and internal publications are marked "don't index", and
  none of their details are shown to search engines.
- Portfolios are listed for search engines only for people with public research.

### New for admins
- A **Reports** tab in the approval queue lists each reported thing once, with every report about
  it, and what was reported as it was at the time (kept even if the author deletes it).
- For each one, you can **dismiss** it, **warn** the person with a message, or **remove** the content:
  - a work is taken off the feed
  - a comment is deleted
  - a message is removed
  - an event is taken off the list
- An admin can't handle a report about themselves.

### Privacy
- Your data export now includes the reports you made, your notification choices, your chat
  reactions and edit times, and the devices you turned push notifications on for.
- Deleting your account also deletes your reports, reactions and push devices. Copies of your
  content kept in reports about you are blanked.
- The app's offline storage keeps only its own code files, never your data.

### Fixed
- Logging out stopped other parts of the app from reacting to the logout. Nothing visible broke,
  but it could have.
- The demo chats now get the same ID numbers on every database, so links to them always open the
  right chat.

### Behind the scenes (for the team)
- **Checks on every push** (GitHub Actions):
  - code style
  - the full test suite on MySQL 8.4, like the server
  - security advisories for the packages that ship
  - static analysis (Larastan, level 5)
  - the React app's types, lint and build
  - a backup-and-restore test
- **Deploys are manual for now:** after a merge, someone runs `deploy.sh` on the server. A GitHub
  workflow that deploys staging after each passing merge (and production on a release tag, after an
  approval) is built but not set up (`tuklas/deploy/README.md`, "Automatic deploys").
- **Nightly encrypted backups** at 10:30 PM, of the database and uploads, kept 30 days, with a
  restore script. The server can make backups but can't read them; the key lives in the team's
  password manager. Each deploy that changes the database takes a backup first.
- **Docs:** a staging server runbook (`docs/STAGING_SERVER.md`), and the feature review with each
  role's actions (`tuklas/reference/FEATURES.md`).
- **Tests:** 134 → 165 passing.

### Coming next
Browse the library by year, department, adviser and tag; view and download counts; @mentions;
following people and topics; and the researchers' own story on a work ("How we made this").
