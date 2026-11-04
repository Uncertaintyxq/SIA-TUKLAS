# 4. System Features

## System Features

This section organizes the functional requirements by system feature, in the order of Section 2.2. Each feature has a code, used in its requirement tags (Section 1.2). Its priority is High when the client's core workflow or a legal or safety requirement depends on it, Medium when it supports engagement, and Low when it is a convenience. The user manual shows each feature's screens and steps.

### Accounts, Sign-In and Privacy

#### Description and Priority

Code: ACC. Priority: High. Members create their accounts, prove that they own their email address, sign in safely, and keep control of their personal data as the Data Privacy Act of 2012 requires. Admin accounts are never created by sign-up.

#### Stimulus/Response Sequences

| User action | System response |
|---|---|
| A Visitor fills in the sign-up form with a school email and accepts the privacy notice | Creates a Student or Educator account in the school that owns the email domain, and sends a confirmation link |
| The member opens the confirmation link | Marks the email as confirmed and opens Tuklas |
| An Educator or Admin signs in for the first time | Requires two-factor sign-in to be set up before anything else |
| A member with two-factor sign-in enters their password | Asks for the 6-digit code from the authenticator app, or a recovery code |
| A member asks to reset a forgotten password | Emails a link that works once, for 60 minutes |
| A member selects "Download my data" | Sends a JSON file of everything Tuklas holds about them |
| A member deletes their account | Erases their personal data and keeps their approved work under "Former member" |

#### Functional Requirements

**REQ-ACC-1:** The system shall let Visitors sign up as a Student or an Educator with a name, email address, password, program or department, and school, only after they accept the current privacy notice.

**REQ-ACC-2:** The system shall place a new member in the school whose email domain (or a subdomain of it) matches their email address. A member whose address matches no school shall choose one, and shall not use Tuklas until an Admin of that school confirms them.

**REQ-ACC-3:** The system shall refuse passwords shorter than 12 or longer than 128 characters, and passwords found in known data breaches. It shall store passwords hashed with Argon2id.

**REQ-ACC-4:** The system shall require a confirmed email address before a member can use Tuklas. Only the newest confirmation link shall work.

**REQ-ACC-5:** The system shall offer two-factor sign-in with time-based one-time codes and single-use recovery codes. It shall require it for Educators and Admins, and let Students turn it on or off.

**REQ-ACC-6:** The system shall refuse a two-factor code that has already been used, and limit sign-in attempts to 5 a minute for each account and 30 a minute for each network address.

**REQ-ACC-7:** The system shall reset a password only through an emailed link that works once and expires after 60 minutes.

**REQ-ACC-8:** The system shall list the browsers where a member is signed in, and sign out all the others on request, after the password is entered again.

**REQ-ACC-9:** The system shall ask every member to accept the privacy notice again whenever its version changes.

**REQ-ACC-10:** The system shall let a member download all their personal data as a JSON file.

**REQ-ACC-11:** The system shall let a Student or Educator delete their own account after entering their password. It shall erase their personal data, files, messages and memberships, and keep their approved works, reviews and group hand-ins under the name "Former member". Admins shall not delete their own accounts.

**REQ-ACC-12:** The system shall never create an Admin account through sign-up.

### Portfolios

#### Description and Priority

Code: PORT. Priority: High. The client asked for the public portfolio to be built first. Every member has a public page that presents their academic profile, with research and literary works first.

#### Stimulus/Response Sequences

| User action | System response |
|---|---|
| Anyone opens a member's portfolio address | Shows their profile, works, publications, links, background and honors, without asking anyone to sign in |
| A member edits their profile, links, background or honors | Saves the change and shows it on the public page |
| A member adds an honor | Shows it as "Pending verification" until an Admin verifies it |
| A member uploads a CV | Lets visitors view and download it |

#### Functional Requirements

**REQ-PORT-1:** The system shall give every member a public portfolio at an address made from their username.

**REQ-PORT-2:** The portfolio shall show, in this order, research and literary works, then academic background (diplomas and degrees), then honors and awards (awards, grants and certifications).

**REQ-PORT-3:** The system shall let a member edit their photo, name, titles, program or position, department, short bio and extended bio.

**REQ-PORT-4:** The system shall let a member add academic links (Google Scholar, ORCID, ResearchGate, LinkedIn, faculty page), entries of academic background, honors and a CV in PDF.

**REQ-PORT-5:** The system shall show an honor as verified only after an Admin of the member's school verifies it.

**REQ-PORT-6:** The portfolio shall show counts of the member's published works, verified honors, degrees, followers, views and downloads.

**REQ-PORT-7:** The portfolio shall show only works that are approved and that the reader may see (REQ-WORK-9).

### Works and Adviser Review

#### Description and Priority

Code: WORK. Priority: High. This is the client's core rule: a student's research, literary work or innovation becomes public only after a research adviser or the academic panel approves it.

#### Stimulus/Response Sequences

| User action | System response |
|---|---|
| A Student fills in "New entry" and selects "Submit for adviser review" | Saves the work as "Submitted", keeps version 1, and notifies the adviser |
| The adviser selects "Start review" | Marks the work "Under review" and tells the authors |
| The adviser returns the work with comments and a checklist | Marks it "Needs revision" and notifies the authors |
| The Student ticks the checklist and resubmits | Keeps the new version and notifies the adviser |
| The adviser selects "Approve & sign off" | Publishes the work to the feed and the authors' portfolios, with the adviser's name as approver |
| The adviser selects "Reject" and confirms | Marks the work as not approved, for good |

#### Functional Requirements

**REQ-WORK-1:** The system shall let a Student create a work of type research paper, literary work or innovation, with a title, keywords, abstract, research adviser, optional story ("How we made this"), co-authors and a PDF of up to 20 MB.

**REQ-WORK-2:** While a Student types a work's keywords, the system shall list similar approved works at their school.

**REQ-WORK-3:** The system shall keep a work private to its authors, its adviser and the Admins until it is approved.

**REQ-WORK-4:** The system shall move a work through the statuses Draft, Submitted, Under review, Needs revision, Approved and Rejected, and only by the actions in the sequences above.

**REQ-WORK-5:** Only the work's adviser, or an Admin of its school acting for the academic panel, shall approve, return or reject a work, and only when the adviser is a verified Educator.

**REQ-WORK-6:** When returning a work, the adviser shall give comments and may give a checklist of fixes. The authors shall tick each fix, and the adviser shall confirm every fix before the work can be approved.

**REQ-WORK-7:** The system shall keep every submitted version of a work, with the review history and a private review thread for the authors, the adviser and the Admins.

**REQ-WORK-8:** The system shall ask for confirmation before rejecting a work, and a rejected work shall not be resubmitted.

**REQ-WORK-9:** The authors shall choose who can read the work once it is approved: everyone, or only signed-in members of their school. They may change this later.

**REQ-WORK-10:** The system shall record a work's defense stages (proposal, colloquium, final defense, revisions, published), each with its date, panel, verdict (pending, passed, passed with revisions, failed) and notes.

**REQ-WORK-11:** A draft shall be editable and deletable by its authors; a submitted work shall change only through "Revise & resubmit" when it is returned.

### Educator Publications

#### Description and Priority

Code: PUB. Priority: Medium. Educators publish their own research beside their students' works.

#### Stimulus/Response Sequences

| User action | System response |
|---|---|
| An Educator fills in "New research" and saves it as a draft | Keeps it visible to its authors only |
| The Educator chooses "School only" or "Public" and selects "Publish" | Publishes it to the library and the authors' portfolios for that audience |

#### Functional Requirements

**REQ-PUB-1:** The system shall let an Educator write a publication with a title, abstract, keywords, methodology, full text, an optional PDF and co-authors.

**REQ-PUB-2:** A publication shall be a draft (its authors only), school only (signed-in members of the authors' school) or public (anyone, and search engines).

**REQ-PUB-3:** Only an Educator whose publishing right is on (REQ-ADM-3) shall publish as school only or public.

**REQ-PUB-4:** The system shall offer APA 7 and MLA 9 citations and a shareable link for each publication.

### Discovery

#### Description and Priority

Code: DISC. Priority: High. Members and Visitors find approved research, and engage with it, without the platform becoming general social media.

#### Stimulus/Response Sequences

| User action | System response |
|---|---|
| A member opens the community feed and chooses filters | Shows the approved works, opportunities and events that match, newest or most discussed first |
| A member reacts to, saves or comments on a work | Records it, and notifies the authors of a comment |
| A member types @ and a name in a comment | Notifies that person, if they can see the work |
| A member follows a person, department or keyword | Shows their new works under "Following" in the feed |
| Anyone opens a work and selects "Copy citation" | Copies the citation in APA 7 or MLA 9 |

#### Functional Requirements

**REQ-DISC-1:** The feed shall show only approved works that the reader may see, with opportunities and events, filtered by type, department, year, adviser and keyword, and sorted by newest or most discussed.

**REQ-DISC-2:** The research library shall let members search and browse by title, keyword, author, year, department, adviser and type.

**REQ-DISC-3:** The system shall let members react to a work as Insightful, Useful or Inspiring, save it to their library, and comment in its public discussion.

**REQ-DISC-4:** The system shall notify a person mentioned with @ in a discussion or chat, only if that person can see where they were mentioned.

**REQ-DISC-5:** The system shall let members follow people, departments and keywords.

**REQ-DISC-6:** The system shall count each work's and publication's views and downloads, and show the authors their reach.

**REQ-DISC-7:** The system shall give every work a citation in APA 7 and MLA 9, a shareable link and a QR code that opens it.

**REQ-DISC-8:** Public pages of works and publications shall carry Google Scholar citation tags and link-preview (Open Graph) tags, and be listed in a sitemap.

**REQ-DISC-9:** Search at the top of every screen shall find works, keywords and people.

### Research Groups and Deliverables

#### Description and Priority

Code: GRP. Priority: High. Advisers run their students' research between defenses in groups, which double as group chats and collect deliverables.

#### Stimulus/Response Sequences

| User action | System response |
|---|---|
| An Educator creates a group | Makes them its adviser, with a #general channel |
| The adviser adds a member | Adds them with a role and notifies them |
| An organizer adds a deadline that collects work | Notifies the group; lists who has handed in, who hasn't, and who is late |
| A Student hands in a file with a note | Keeps it as a new version, posts a line in #general, and notifies the reviewers |
| The adviser accepts it or asks for a revision | Records the decision and feedback, and notifies the Student |

#### Functional Requirements

**REQ-GRP-1:** The system shall let an Educator create a research group, of which they become the adviser.

**REQ-GRP-2:** Group members shall have one role: leader, member or mentor. Admins of the group's school, and the adviser and mentors who have the right to moderate groups (REQ-ADM-3), shall add and remove members and change their roles.

**REQ-GRP-3:** A group shall have chat channels, shared files, announcements, deadlines and an activity list. Those who can moderate the group (REQ-GRP-2) and its leader, together its organizers, shall add channels and deadlines.

**REQ-GRP-4:** A deadline shall collect nothing (a reminder), one hand-in from each Student, or one hand-in for the whole group.

**REQ-GRP-5:** Only the group's leader and members shall hand in deliverables: a file of up to 15 MB and an optional note. Every version shall be kept with its feedback.

**REQ-GRP-6:** Only the adviser, mentors and Admins shall see every hand-in, and accept it or ask for a revision with feedback.

**REQ-GRP-7:** The system shall mark hand-ins made after the due date as late, and show who hasn't handed in.

**REQ-GRP-8:** Each hand-in shall be announced in the group's #general channel by its title and version only, never with the file.

### Chat

#### Description and Priority

Code: CHAT. Priority: Medium. Members talk one to one and in their groups' channels.

#### Stimulus/Response Sequences

| User action | System response |
|---|---|
| A member sends a message | Stores it encrypted, and shows it at once in the other members' open chats |
| A member reacts, replies in a thread, edits or removes their own message | Updates the conversation for everyone in it |
| An organizer writes @everyone in a group channel | Notifies every member of the group |

#### Functional Requirements

**REQ-CHAT-1:** The system shall offer direct conversations between two members, and a group's channels to its members.

**REQ-CHAT-2:** The system shall store message text encrypted.

**REQ-CHAT-3:** Members shall send text and files, reply in threads, react, edit and remove their own messages. Admins shall remove any message.

**REQ-CHAT-4:** The system shall show who has read a member's latest message, and who is online.

**REQ-CHAT-5:** Members shall find a conversation by a person's, channel's or group's name, and filter to direct, channels or unread. The system shall not search inside message text.

**REQ-CHAT-6:** Only a group's organizers (REQ-GRP-3) shall notify the whole group with @everyone or @all.

**REQ-CHAT-7:** The system shall limit each member to 40 messages a minute.

### Events, Ads and Opportunities

#### Description and Priority

Code: EVT. Priority: Medium. Academic events, their ads in the feed, and Educators' opportunities, all limited to academic content.

#### Stimulus/Response Sequences

| User action | System response |
|---|---|
| An Educator proposes an event | Holds it until an Admin approves it, then lists it |
| A member selects "Register" | Registers them while seats remain; selecting "Registered" again cancels |
| The organizer cancels the event | Notifies everyone registered |
| The organizer requests an ad slot | Holds it until an Admin approves it, then shows it in the feed's sidebar between its dates |
| A Student applies to an opportunity with a message | Sends the application, with their portfolio, to the Educator |

#### Functional Requirements

**REQ-EVT-1:** Events shall belong to one academic category: research colloquium, thesis defense, research fair, school innovation, or the C.P. Garcia event.

**REQ-EVT-2:** An event shall be listed only after an Admin of its school approves it.

**REQ-EVT-3:** The system shall let members register for an event and cancel, and refuse registrations when its seats are full.

**REQ-EVT-4:** An ad shall promote an approved academic event only, with a headline, dates and an optional image, and shall be shown only after an Admin approves it. Commercial content shall not be accepted.

**REQ-EVT-5:** The system shall let Educators post opportunities (mentorship, grant or call for submissions) with a description, deadline and optional number of slots.

**REQ-EVT-6:** Students shall apply to an opportunity with a message, and withdraw their application.

**REQ-EVT-7:** Events and opportunities shall be visible to the posting school only, or to every school, as their author chooses.

### Announcements

#### Description and Priority

Code: ANN. Priority: Medium. The research office, departments and groups tell their audiences what they need to know.

#### Stimulus/Response Sequences

| User action | System response |
|---|---|
| An author posts an announcement | Notifies everyone in its audience in the app and by email |
| A member opens it | Records that they have read it |

#### Functional Requirements

**REQ-ANN-1:** An announcement shall reach one audience: everyone on Tuklas, a school, a department, or a research group.

**REQ-ANN-2:** Super-admins shall post to everyone, Admins to their school, and Educators with the broadcast right to their department or groups.

**REQ-ANN-3:** An announcement shall have a title, formatted text and up to 5 attachments of up to 15 MB each, and may be pinned.

**REQ-ANN-4:** The system shall show its author who in the audience has read it.

### Notifications

#### Description and Priority

Code: NOTIF. Priority: Medium. Members hear about what concerns them, in the app and, if they choose, by email or push.

#### Stimulus/Response Sequences

| User action | System response |
|---|---|
| Something concerns a member (a review, comment, mention, deadline, announcement) | Adds it to their updates at once, and sends an email or push notification if they chose so |
| A member turns on notifications on a device | Sends push notifications to that device |

#### Functional Requirements

**REQ-NOTIF-1:** The system shall show every notification in the member's updates, live, with a count of unread ones.

**REQ-NOTIF-2:** Each member shall choose, by kind of notification, whether it also arrives by email and by push.

**REQ-NOTIF-3:** The system shall send push notifications through the Web Push standard to each device where the member turned them on.

**REQ-NOTIF-4:** The system shall send an optional weekly digest email on Monday mornings: unread updates, the week's deadlines and events, and new research from the member's department.

**REQ-NOTIF-5:** Live updates shall say only what changed, never the content.

### Reports and Moderation

#### Description and Priority

Code: MOD. Priority: High. Every public academic platform must let people report abuse, and let the research office act on it.

#### Stimulus/Response Sequences

| User action | System response |
|---|---|
| A member reports a work, comment, message, event or person with a reason | Adds it to the Admins' report queue |
| An Admin dismisses, warns or removes | Records the outcome and notifies the reporter, and the owner of a warning |
| An Admin removes or restores a work | Takes it off or puts it back on the site |

#### Functional Requirements

**REQ-MOD-1:** The system shall let members report works, comments, messages, events and people, for plagiarism, inappropriate content, harassment, spam, sharing private information, or something else, with optional details.

**REQ-MOD-2:** The system shall not tell the reported person who reported them.

**REQ-MOD-3:** Admins shall dismiss a report, warn the content's owner, or remove the content, and the reporter shall be told the outcome.

**REQ-MOD-4:** Admins shall remove and restore works, and delete any comment, message and opportunity.

**REQ-MOD-5:** The system shall record moderation and administrative actions, such as decisions on reports, role changes and verifications, in an audit log.

### Administration and Schools

#### Description and Priority

Code: ADM. Priority: High. The research office of each school runs its part of the site; Super-admins look after all the schools.

#### Stimulus/Response Sequences

| User action | System response |
|---|---|
| An Admin verifies an Educator | Lets them review works; their rights then follow the Admin's switches |
| An Admin confirms a sign-up | Lets the member use Tuklas, and tells them by email |
| A Super-admin adds a school with its email domains | Places new sign-ups with those domains in the school |

#### Functional Requirements

**REQ-ADM-1:** An Admin shall act only for their own school; a Super-admin shall act for every school, and choose which one to work on.

**REQ-ADM-2:** Admins shall verify Educators, or make their accounts Student accounts.

**REQ-ADM-3:** Admins shall switch three rights on or off for each Educator: publishing research, moderating groups, and posting announcements.

**REQ-ADM-4:** Admins shall confirm members who signed up without the school's email address, and manage the school's departments.

**REQ-ADM-5:** Admins shall approve or reject student works for the academic panel, events, ad slots, and honors and grants.

**REQ-ADM-6:** Admins shall search members and change their roles; Super-admins shall also move members between schools and make Admins Super-admins.

**REQ-ADM-7:** Super-admins shall add schools and edit their names, short names and email domains.

**REQ-ADM-8:** The approval queue shall show the number of items waiting in each of its tabs, and statistics of the school's activity.
