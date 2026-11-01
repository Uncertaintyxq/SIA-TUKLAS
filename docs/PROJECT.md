# Project context

<!-- Imported into every Claude session via CLAUDE.md. Keep it short and current.
     The client's own words are in tuklas/reference/ (read its README before changing scope). -->

## What Tuklas is

"From Defense to Discovery": a research and academic engagement hub for a university. Students
build public academic portfolios and submit research and literary works; a research adviser or the
academic panel approves a work before it goes public; everyone discovers approved work in a
community feed and library. Client: name withheld. First release was due the first week of November
2026; the conversion to Laravel is complete and deployment is next.

## Users and roles

- **Visitor** (signed out): reads public portfolios (`/u/<username>`), approved works and public research.
- **Student**: portfolio, submits works to an adviser, comments, saves, joins research groups and
  hands in deliverables, chats, registers for events, applies to opportunities.
- **Educator** (research adviser): everything a student can, plus reviewing and approving advisees'
  works, publishing their own research, running research groups, posting opportunities and
  announcements. Must be verified by an admin first; rights can be switched off per educator.
- **Admin** (Office of Research): verifies educators, approves events, ads and honors, moderates,
  manages people. Admin accounts are issued, never self-created.

## Domain glossary

| Term | Meaning | Model / table |
|---|---|---|
| Work | A student's research or literary work, from draft to approved | `Work` / `works` |
| Review | An adviser's or panel decision on a submitted work | `Review` / `reviews` |
| Publication | An educator's own research (draft, internal, public) | `Publication` / `publications` |
| Research group | Adviser-led group: members, channels, files, deadlines | `ResearchGroup` / `research_groups` |
| Deliverable | A group deadline that collects work (each student, or one per group) | `GroupDeadline`, `DeliverableSubmission` |
| Opportunity | Mentorship, grant or call for submissions posted by an educator | `Opportunity` |
| Event / Ad | Academic event; an ad is its approved slot in the feed sidebar | `Event`, `Ad` |
| Former member | What a deleted account shows as (D13) | `users.account_deleted_at` |

## Current milestone

The Laravel conversion is done. Next: tooling (`chore/ci`, `chore/larastan`), then deployment
(`chore/deploy-*`, see `docs/DEPLOYMENT.md`). Live list: `docs/TODO.md`.

## Non-negotiables

- Student work is public only after adviser or panel approval. The server enforces it.
- Ads and events are academic only (colloquiums, school innovations, the C.P. Garcia event). No commercial content.
- Personal data is protected under the Data Privacy Act (RA 10173): chat and review text are
  encrypted, data export and account deletion exist, personal data is never logged.
- 2FA is required for educators and admins (outside demo mode).
- Every rule lives on the server; the UI only reflects it.

## Out of scope (for now)

- Personal quotes on how the research was made (client Q&A 2a): not built.
- Searching inside chat messages (they're encrypted; D7).
- Passkeys sign-in (optional later).
