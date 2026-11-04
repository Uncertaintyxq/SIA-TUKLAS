# 0002. Hold several schools on one Tuklas site, with published research open across them

- Status: accepted and built (the client's answers are in; all four rows merged 2026-11-04)
- Date: 2026-11-04
- Deciders: Jun Mari Manla

## Context

Tuklas was built for one university per site (`docs/DEPLOYMENT.md`, `TUKLAS_INSTITUTION`). The
answer is now several schools on one site, and research a school publishes can be read from the
others. Today one site would mix schools: department announcements reach every school with a
department of the same name, internal research is open to every account, the digest and library
mix schools, one set of admins handles everyone, and Google Scholar gets one university name.

No real student data is on any server yet (staging holds demo data only), so this is built before
launch instead of moving real accounts later (`docs/TODO.md`, "Before real student data").

## Decision

**Every person belongs to one school.** Content made inside a school carries that school too, so
history stays right when someone changes schools.

**Visibility.** Published research is open to all unless its researchers choose **School only**.
Work in progress, and anything a school runs, stays inside that school.

**School only** means: readable by signed-in members of the school the research belongs to (the
submitting student's or the publishing educator's school), plus its own authors, co-authors and
adviser wherever they are. Nobody signed out, and nobody at another school. It stays out of
Google Scholar, link previews and the sitemap, and followers at other schools aren't told about it.

| What | Who sees it |
|---|---|
| Approved student works and educators' research marked **Public** | Everyone, every school, signed out too (as today) |
| Approved student works and educators' research marked **School only** | Signed-in members of that school, plus its authors and adviser. Replaces educators' "Internal" (today: any account); new for student works |
| Portfolios | Everyone (unchanged), now showing the school |
| Drafts, reviews, revision threads | Authors, the adviser, that school's admins (unchanged otherwise) |
| Research groups and their chats | Members, who may come from any school; the group belongs to its adviser's school |
| Department announcements | That department at that school only |
| School announcements | That school; super-admins can post to every school |
| Opportunities, events, ads | The posting school by default; the poster can open them to all schools |
| Direct messages | Anyone signed in, at any school; reports go to the sender's school |
| Follows, @mentions, reactions, discussion | Unchanged: they already follow who may read the work |

**Who chooses.** Educators choose Public or School only when they publish (and can change it
later). Students choose it on the work's form and can change it until approval; the adviser sees
the choice when reviewing and approves the work as chosen. After approval, the authors can switch
between the two at any time.

**Choosing within a school, browsing across them.**
- A student picks an adviser from their own school: the adviser approves the work for that school.
- Co-authors, group members and mentors may come from any school; each is shown with their school.
- The feed, library and people search show every school by default. A School filter offers "my school", any one school, or all of them.
- Departments are always shown as "Department · School".

**Departments become a list per school** (`departments`: school, name), managed by that school's
admins. They replace today's free-text department, so filters, follows and announcements match
exactly ("College of Computing" at two schools stays two departments).

**Admins per school, plus super-admins.**
- A school's admins handle their own school:
  - verify its educators and honors
  - approve its events and ads
  - moderate its works and groups
  - handle reports about its people and content
  - grant rights (publish, moderate groups, broadcast)
  - post school announcements
- Super-admins manage schools, departments and school admins, and can act anywhere.
- Everything that today tells "the admins" tells that school's admins; super-admins step in when a school has none.

**Signup.**
- The school is matched from the email domain (each school lists its domains).
- A school with no email domain of its own (or a person signing up with another address) needs an
  admin's confirmation: the person picks their school from a list, and the account waits until
  that school's admins confirm it, like educator verification today.
- Only super-admins move a person to another school.

**Google Scholar and link previews** use the author's own school, replacing `TUKLAS_INSTITUTION`.

**Data Privacy Act.**
- Each school is the personal information controller for its own people.
- Whoever runs the site is their processor, with a data processing agreement signed with each school.
- Each school names its own Data Protection Officer.
- The data export and account deletion stay per person, as today.

### Build plan (rows in `docs/TODO.md`)

1. **`feat/institutions`**: the schools themselves.
   - Data: an `institutions` table (name, short name, email domains, active) and `users.institution_id`.
   - Signup by domain or by choosing a school, with the confirm step.
   - The school on person cards and portfolios; Google Scholar uses it.
   - Super-admins add and edit schools (an `is_super_admin` flag on admins).
   - A migration puts every existing account in one default school, and `DemoSeeder` gets a second school with its own people.
2. **`feat/institution-scoping`**: what stays inside a school.
   - The `departments` table, with `profiles.department_id` replacing the text.
   - `institution_id` on works, publications, groups, opportunities, events, ads and announcements.
   - Every rule in the table above:
     - School-only research: educators' "Internal" renamed, and the same Public or School only choice
       added to student works (`works.visibility`; `Work::public()` becomes "readable by" the viewer)
     - the adviser picker (members and co-authors stay open to every school)
     - announcements
     - the digest
     - feed, library and people-search filters
     - opportunity and event audiences
     - follows of a department
   - Opportunity, event and ad audiences and the school announcement scope were split off into
     **`feat/institution-audiences`** (2026-11-04), to keep each branch reviewable.
3. **`feat/institution-admins`**: admins per school.
   - Policies and gates check the school; admin screens and queues show one school (a school switcher for super-admins).
   - `Notifier::notifyAdmins` takes the school, and reports go to the content owner's school.
   - Super-admin screens for schools, departments and school admins.

Each row adds cross-school tests: someone at school B must not see school A's Internal research,
drafts, school-only opportunities and events, or admin queues (or a group they're not in), and must
still see its published research.

## Consequences

- The feed and the library become a shared research library across schools. That's the point of being on one site.
- Most controllers gain a school check. Without one test per rule, a missed check leaks across
  schools, so each row needs the cross-school tests above.
- Departments stop being free text, and school admins must keep each school's list.
- One site, one server and one deploy for every school. An outage or breach affects all of them,
  which raises the stakes for off-server backups and the security checklist.

## Alternatives considered

- **One site per school** (set `TUKLAS_INSTITUTION` on each): no code change, but research isn't shared across schools, and each school needs its own server and upkeep.
- **Schools as a label only** (no scoping, one admin team): quick, but department announcements and internal research leak across schools, and one admin team decides for every school.

## Answers (2026-11-04)

1. **Research visibility:** when research is published, its researchers choose **Public** or
   **School only** (the researcher's own school). School only replaces educators' "Internal" (all
   signed-in accounts), and student works get the same choice.
2. **Across schools:** co-authors can come from other schools, so a research group can have members
   from different schools too.
3. **Signup:** without a school email domain, an admin of the chosen school confirms the account.
4. **Direct messages:** to anyone, at any school.

5. **Super-admins:** the team running the site plus one university contact (at least two people,
   so access isn't lost if one leaves). They add schools and their email domains, appoint and
   remove each school's admins, manage the department lists, move people between schools, act when
   a school has no admin, and post announcements to every school.
6. **Student works:** get the same Public or School only choice as educators' research.

Nothing is left open; the client's answers are all in.
