# Data Processing Agreement

> **Draft, 2026-11-04.** Written by the Tuklas team for review by the school's Data Protection
> Officer or legal office; not legal advice. Fill in everything in [brackets]. It follows the
> contents the Data Privacy Act's implementing rules (Section 44) require in a contract with a
> processor.

This agreement is made on [date] between:

- **[School's full name]**, of [address], represented by [name and position] (the **School**),
  the personal information controller; and
- **[Operator's name]**, of [address] (the **Operator**), who runs Tuklas, the personal
  information processor.

## 1. What this covers

1.1 The Operator runs **Tuklas**, a research and academic hub at [https://domain], for the
School's students, educators and research staff. Through it they publish research works and
portfolios, have works reviewed and signed off by advisers, run research groups with chat, files
and deadlines, and receive announcements and notifications.

1.2 This agreement covers the personal data of the School's people that Tuklas holds. It runs
from the date above until the School stops using Tuklas, and then clause 9 applies.

## 2. The data and the people

| | |
|---|---|
| People | The School's students (including minors), educators, research staff and administrators, and the visitors who contact them |
| Personal information | Name, school email, role, program or department, profile and portfolio, sign-in records (IP address, browser, time), important account actions |
| Sensitive personal information | Information about a person's education: research works and their versions, adviser reviews, revision requests and feedback, group deliverables |
| Other content | Comments, messages and group chat (stored encrypted), group files, event registrations and applications |
| Not collected | Grades, ID numbers, government IDs, health, payment details |

## 3. The Operator's obligations

The Operator shall:

3.1 Process the data only to run Tuklas as described in clause 1, and on the School's documented
instructions, including this agreement. If an instruction would break the Act, the Operator tells
the School at once.

3.2 Make sure everyone who can reach the data (developers, server administrators) is bound to keep
it confidential, and has only the access their work needs.

3.3 Keep the organisational, physical and technical security measures in Annex A, and keep them up
to date.

3.4 Use only the sub-processors in Annex B. The Operator tells the School in writing at least 30
days before adding or replacing one, so the School can object, and binds each sub-processor to the
same obligations as this agreement.

3.5 Help the School answer requests from its people to access, correct, download, object to or
erase their data, and to withdraw consent. Most can be done in Tuklas itself ("Download my data",
editing a portfolio, deleting an account). The Operator handles the rest within [10] working days.

3.6 Tell the School's DPO about any personal data breach, or suspected breach, affecting the
School's people **within 24 hours** of learning of it, following the breach response plan, so the
School can notify the National Privacy Commission and the people affected within 72 hours.

3.7 Help the School with privacy impact assessments, NPC registration and NPC inquiries about
Tuklas.

3.8 Give the School the information it needs to show compliance, and allow an audit or inspection
by the School, or an auditor it names, with [10] working days' notice.

3.9 Name a compliance officer for privacy: [name, email].

## 4. The School's obligations

The School shall:

4.1 Decide which of its people use Tuklas and why, and make sure it has a lawful basis for it.

4.2 Name its Data Protection Officer: [name, email, phone]. Their contact is shown in Tuklas's
privacy notice.

4.3 For students under 18, get the consent of a parent or guardian, for example in its enrolment
or research consent forms.

4.4 Approve the privacy notice shown to its people, and tell the Operator when it must change.

4.5 Name the School's administrators in Tuklas, and remove them when they leave.

## 5. Where the data is kept

5.1 Tuklas runs on Microsoft Azure in the **Japan East** region; encrypted backups are also copied
to [Google Drive / another location]. The School agrees to this transfer outside the Philippines.
The Operator stays responsible for the data there, and tells the School before moving it to
another country or provider.

## 6. Retention

6.1 Personal data is kept while the person's account exists. When an account is deleted, its
personal data is erased, and the works the person authored stay under the name "Former member".

6.2 Application logs are kept 14 days, and backups 30 days.

6.3 What happens to the accounts of people who leave the School (graduates, staff who move): [the
School decides, for example: deleted one year after graduation unless the person keeps the account].

## 7. Public works

7.1 Works an adviser or panel approves, and portfolios their owners make public, can be seen by
anyone on the internet and found by search engines. The School and its people decide what is made
public; the Operator removes a public work at the School's request within [2] working days.

## 8. Liability

8.1 Each party is responsible for its own breaches of the Act and of this agreement. [Add any
limits the School's legal office requires.]

## 9. When it ends

9.1 Within [30] days of the end of this agreement, the Operator, as the School chooses, either gives
the School a copy of its people's data and then deletes it, or deletes it straight away, and
confirms the deletion in writing. Backups that hold it expire within 30 days after that.

## Signatures

| For the School | For the Operator |
|---|---|
| Name: | Name: |
| Position: | Position: |
| Signature and date: | Signature and date: |

---

## Annex A: Security measures

**Organisational**
- A compliance officer for privacy; access to the server for at least two named people only.
- Passwords, keys and secrets kept in a password manager, never in chat, email or git.
- This agreement's breach response plan, and a yearly review of these measures.

**Technical**
- HTTPS everywhere (TLS, HSTS), and a content security policy.
- Passwords stored with Argon2id; known-breached passwords refused; rate limits on sign-in.
- Two-factor sign-in required for educators and administrators, optional for students.
- Messages and review comments encrypted at rest; uploaded files kept in private storage, not on
  public links.
- An audit log of important account and admin actions.
- Each school's people, announcements and admins kept apart; school admins act only for their own
  school.
- Encrypted daily backups, kept 30 days, with a copy off the server; a restore tested before launch.
- Only the cookies the site needs (session and CSRF); no advertising or tracking.

**Physical**
- The server is in a Microsoft Azure data centre; no copy of the database is kept on personal
  computers.

## Annex B: Sub-processors

| Sub-processor | What it does | Where |
|---|---|---|
| Microsoft Azure | Runs the server, the database and the stored files | Japan East |
| Brevo | Sends sign-up, password reset and notification emails | European Union |
| Cloudflare | DNS; forwards emails sent to the site's admin addresses | Global |
| Google Drive | Holds the encrypted off-server backups | Global |
