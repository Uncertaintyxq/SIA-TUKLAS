# Tuklas QA checklist, release 1.0

One section per area of the app, built from the requirements in Section 4 of the SRS. Each "- "
line becomes one numbered check; "- [Dev] " marks a check that needs server access. A "Use:" line
under a heading says which accounts to sign in as. Build the Word file with:

    python docs/qa/build.py

## 1. Visitors

Use: a private (incognito) window, not signed in.

- Open a student's portfolio from the feed or from search. It shows without asking you to sign in.
- Open a public work and a public publication. Both show without asking you to sign in.
- On a work, select "Copy citation". The APA 7 and MLA 9 texts are complete and correct.
- A work's share link opens the same work, and scanning its QR code with a phone opens it too.
- Search at the top finds a work by a word of its title, a work by its keyword, and a person by name.
- Sign in as Miguel Torres in a normal window, open a "School only" work of Bayan State College and copy its address. Open that address in the private window: it says "not found" and doesn't ask you to sign in.
- Open /privacy (after the site address). The privacy notice shows.
- Open /sitemap.xml. It lists public works and publications, and no School only or unapproved ones.
- [Dev] A public work's page source has Google Scholar (citation_) and link-preview (og:) tags; a hidden work's page has neither.

## 2. Sign-up and sign-in

Use: a private window. Tuklas sends real emails: those to a @tu.junmm.me or @bsc.junmm.me address arrive in Jun Mari's inbox, so a check that needs an email link is labelled DEV: ask Jun Mari for the link.

- Sign up as a Student with an address ending in @tu.junmm.me (any name before the @). The account is placed in Tuklas University.
- The sign-up form can't be sent without ticking the privacy notice.
- The sign-up form offers Student and Educator only. There is no way to sign up as an Admin.
- A password of 11 characters is refused, and so is a common one such as password12345.
- Before the email is confirmed, the new account can't use Tuklas: a screen asks you to confirm your email.
- [Dev] The confirmation link opens Tuklas. When a second link is sent, the first one no longer works.
- Sign up with a personal address (for example, Gmail) and pick Bayan State College. A waiting screen shows until Bayan's Admin confirms the account (check 14.4).
- An Educator or Admin who hasn't set up two-factor sign-in is asked to set it up before anything else.
- With two-factor sign-in on, signing in asks for the 6-digit code from the authenticator app, and a correct code works.
- Sign out and sign in again at once with the same 6-digit code. The used code is refused.
- A recovery code signs you in once. The same recovery code is refused the second time.
- As Andrea Villanueva (Student), turn two-factor sign-in on, then off, on the Account page.
- Enter a wrong password 6 times within a minute. Tuklas asks you to wait before trying again.
- [Dev] "Forgot password": the emailed link sets a new password once. The same link fails a second time, and a link older than 60 minutes fails.

## 3. Account and privacy

Use: Andrea Villanueva (Student), in two browsers.

- The Account page lists the browsers where you're signed in.
- "Sign out other browsers" asks for your password. Afterwards the other browser is signed out.
- "Download my data" gives a file (JSON) with your profile, works, messages and settings.
- [Dev] After the privacy notice's version is raised, every member is asked to accept it again.
- Delete the test Student account from check 2.1: Tuklas asks for its password, and afterwards that account can't sign in.
- Delete Paolo Reyes's account. His approved works now show "Former member" as an author. (Can't be undone: only after the client presentation; Jun Mari then reloads the showcase.)
- Signed in as Lea Mercado (Admin), the Account page has no "Delete account" option.

## 4. Portfolio

Use: Andrea Villanueva (Student), with a private window to see her public page.

- Change the photo, name, titles, program, department, short bio and extended bio. The public page shows the changes.
- Add academic links (for example, ORCID and LinkedIn) and an academic background entry. They show on the public page.
- Upload a CV (PDF). Visitors can view and download it.
- Add an honor. It shows "Pending verification" until an Admin verifies it (check 14.6).
- The public page shows works first, then academic background, then honors and awards.
- The counts at the top (works, verified honors, degrees, followers, views, downloads) match what the page shows.
- Only approved works appear. Drafts and works under review don't.

## 5. Works and adviser review

Use: Andrea Villanueva (Student) and Dr. Maria Santos (her adviser), in two browsers.

- "New entry": create one research paper, one literary work and one innovation, each with title, keywords, abstract, adviser and a PDF.
- A PDF over 20 MB is refused with a message giving the limit. A file renamed to .pdf that isn't really a PDF is refused.
- While you type keywords, similar approved works are listed.
- A draft can be edited and deleted.
- "Submit for adviser review": the status becomes Submitted, Dr. Santos is notified, and the work can no longer be edited.
- While it's under review, the work isn't in the feed or on Andrea's public portfolio, and Paolo Reyes can't open it ("not found").
- Dr. Santos selects "Start review". The status becomes Under review, and Andrea is told.
- Dr. Santos returns the work with comments and a checklist of two fixes. The status becomes Needs revision, and Andrea is notified.
- Andrea ticks both fixes and uses "Revise & resubmit". Version 2 is kept next to version 1, and Dr. Santos is notified.
- Dr. Santos can't approve until she has confirmed every fix.
- Dr. Santos selects "Approve & sign off". The work appears in the feed and on every author's portfolio, with Dr. Santos named as approver.
- The review history and review thread are seen by the authors, the adviser and Admins only, not by Paolo Reyes or Prof. Ramon Aquino.
- Prof. Ramon Aquino, who isn't the adviser, can't start a review, return, approve or reject the work.
- Prof. Carla Javier, who isn't verified yet, can't approve any work.
- Lea Mercado (Admin) can approve, return or reject a submitted work for the academic panel.
- "Reject" on another submitted work asks for confirmation. Afterwards the rejected work can't be resubmitted.
- After approval, the authors change the work to "School only". Miguel Torres (Bayan) can no longer open it. Changing it back to Public lets him open it again.
- Record a defense stage with its date, panel, verdict and notes. It shows on the work.

## 6. Educator publications

Use: Dr. Maria Santos (Educator), with Paolo Reyes, Miguel Torres and a private window to check who sees it.

- "New research" saved as a draft is seen only by its authors.
- Published as "School only", it's seen by Paolo Reyes, but not by Miguel Torres (Bayan) or a visitor.
- Published as "Public", a visitor sees it too.
- Its co-authors see it on their portfolios.
- Its APA 7 and MLA 9 citations and its share link work.
- When Dr. Santos's publishing right is off (check 14.3), she can save drafts but can't publish.

## 7. Feed, library and engagement

Use: Paolo Reyes (Student), with a second browser for the authors.

- Each feed filter works on its own: type, department, school, year, adviser and keyword.
- Sorting by Newest and by Most discussed both work.
- The feed shows only approved works, with opportunities and events.
- The library finds research by title, keyword, author, year, department, adviser and type.
- "Browse by department" shows counts that match the lists behind them.
- React to a work as Insightful, Useful and Inspiring, and save it to your library.
- Comment on a work. Its authors are notified.
- Type @ and a name in a comment. A picker appears, and the person mentioned is notified.
- Mention Miguel Torres (Bayan) on a School only work of Tuklas University. He is not notified.
- Follow a person, a department and a keyword. The "Following" filter shows their works.
- When a person you follow has a work approved, you are notified.
- Open a public work in a private window. Its view count goes up by one; opening it again the same day doesn't add another. The authors' own visits don't count.

## 8. Research groups and deliverables

Use: Dr. Maria Santos (adviser), Andrea Villanueva and Kim Dela Cruz (Students), in two browsers.

- Dr. Santos creates a group. She is its adviser, and it has a #general channel.
- She adds Andrea as leader and Kim as member. Both are notified. Changing a role and removing a member work.
- Kim, a plain member, can't add members or channels.
- Add a channel, upload a shared file, post a group announcement, and see them in the activity list.
- Add one deadline of each kind: reminder only, one hand-in from each Student, and one hand-in for the whole group.
- Andrea hands in a file with a note. #general shows its title and version only, never the file, and Dr. Santos is notified.
- A hand-in file over 15 MB is refused.
- A hand-in after the due date is marked Late, and the deadline lists who hasn't handed in.
- Handing in again keeps the earlier versions with their feedback.
- Dr. Santos accepts one hand-in and asks for a revision on another, with feedback. Andrea is notified each time.
- On a "one from each Student" deadline, Kim sees her own hand-ins only, not Andrea's.
- A mentor can't hand in deliverables.
- Deleting the group asks for confirmation.

## 9. Chat

Use: Andrea Villanueva and Paolo Reyes, in two browsers side by side.

- A direct message appears in the other browser at once, without reloading.
- Send a file, reply in a thread and react to a message. The other browser updates.
- Edit your own message: it shows "edited". Remove your own message: it disappears for both.
- "Seen by" shows on the latest message, and the online dot shows who is online.
- Lea Mercado (Admin) can remove anyone's message.
- Find a conversation by a person's, a channel's and a group's name. The All, Direct, Channels and Unread filters work.
- In a group channel, the adviser's @everyone notifies every member. A plain member's @everyone notifies no one.
- [Dev] More than 40 messages in a minute are refused for a while.
- [Dev] In the database, message text is stored encrypted.

## 10. Events, ads and opportunities

Use: Dr. Maria Santos (organizer), Lea Mercado (Admin), Paolo Reyes and Andrea Villanueva (Students), Miguel Torres (Bayan).

- Dr. Santos proposes an event. It is offered only the five academic categories, and isn't listed until Lea approves it.
- Paolo selects "Register", then "Registered" again to cancel. Both work.
- On an event with 1 seat, a second person's registration is refused.
- Dr. Santos cancels an event. Everyone registered is notified.
- Dr. Santos requests an ad slot. It shows in the feed's sidebar only after Lea approves it, and only between its dates.
- Dr. Santos posts an opportunity with a deadline and slots. Andrea applies with a message, Dr. Santos sees the application with Andrea's portfolio, and Andrea withdraws it.
- An event or opportunity for "this school only" isn't seen by Miguel Torres. One for all schools is.

## 11. Announcements

Use: Lea Mercado (Super-admin), Jose Ramos (Bayan Admin), Dr. Maria Santos (Educator).

- Lea can post to everyone on Tuklas.
- Jose Ramos can post to Bayan State College and its departments only.
- Dr. Santos, with the announcement right on, can post to her department or her groups. With it off (check 14.3), she can't post.
- Attach 5 files to an announcement. A sixth file, or a file over 15 MB, is refused.
- A pinned announcement stays at the top.
- Everyone in the audience is notified in the app.
- The author sees who in the audience has read it.
- [Dev] The announcement email is sent to the audience.

## 12. Notifications and installing the app

Use: any member, in two browsers, and a phone.

- The updates count goes up live, without reloading, when the other browser comments, mentions or messages you.
- On the Account page, turn on notifications on this device. With the tab closed, a push notification arrives.
- Turn push off for one kind of notification. That kind no longer arrives as push.
- Install Tuklas from the browser (Install app, or Add to Home Screen on a phone). It opens like an app.
- With the connection off, the installed app shows an offline page.
- [Dev] The email switches for each kind are obeyed (the emails arrive only when switched on).
- [Dev] The weekly digest (php artisan tuklas:weekly-digest) has unread updates, the week's deadlines and events, and new research in the member's department.

## 13. Reports and moderation

Use: Paolo Reyes (reporter), Lea Mercado (Admin), and the owner of the reported content.

- Paolo reports a work, a comment, a chat message, an event and a person, each with a reason.
- The reports reach Lea's Reports queue. The reported person is never told who reported them.
- Lea dismisses one report, warns on another and removes the content of a third. Paolo is told each outcome, and the owner is told of the warning.
- Lea removes a work, which leaves the site, then restores it, which puts it back.
- Each of these actions appears in the audit log.

## 14. Admins and schools

Use: Lea Mercado (Super-admin, Tuklas University) and Jose Ramos (Admin, Bayan State College). Some of these can't be undone: do this area after the client presentation; Jun Mari then reloads the showcase.

- Lea verifies Prof. Carla Javier. She can now review and approve works.
- Lea makes an Educator's account a Student account.
- Lea switches each of Dr. Santos's three rights (publishing, moderating groups, posting announcements) off and on. Each takes effect at once.
- Jose Ramos confirms Rina Cruz's sign-up. She can now use Tuklas.
- Add a department, and remove an unused one. A department in use can't be removed.
- Verify the honor from check 4.4. It now shows as verified on the portfolio.
- The approval queue shows the number waiting in each tab, matching its lists, and the school's statistics.
- From the approval queue, approve and reject events, ads and honors.
- In Users & roles, search for a member and change their role.
- Jose Ramos sees no School field and no Super-admin switch in Users & roles. Lea sees both.
- Lea switches between the two schools with the school picker.
- Lea adds a school with an email domain. A new sign-up with that domain goes into it.
- Lea moves a member to another school. Tuklas asks for confirmation first.
- Lea can't remove her own Super-admin status.

## 15. Two schools: what stays private

Use: Miguel Torres (Bayan Student), Jose Ramos (Bayan Admin), Dr. Ana Lim (Bayan Educator).

- Miguel sees Tuklas University's public works and publications.
- Miguel doesn't see Tuklas University's School only works, drafts, groups, or its school-only events and opportunities. Opening one by a copied address says "not found".
- Jose Ramos's approval queue, reports and users show no Tuklas University items. Opening one by a copied address is refused.
- When Miguel picks an adviser, only Bayan's Educators are offered.
- Co-authors and group members can be from either school, and each shows their school.

## 16. Every screen

Use: any account, on a computer and a phone.

- At phone width, every screen fits with no sideways scrolling, and the menus work.
- The light and dark themes are both readable.
- Every action that can't be undone asks for confirmation: deleting an account, rejecting a work, cancelling an event, deleting a group, moving a member to another school.
- A file renamed to look like a picture or PDF (for example, a .exe renamed to .jpg) is refused wherever you upload.
- No screen shows an error page, broken layout or typo. Note any you find.
- [Dev] With the real-time server stopped, the site still works and shows changes after a reload.

## 17. Production server (team, after it is set up)

Use: server access (a developer). The launch check fails while the showcase is loaded: run it once the showcase is emptied, before real data.

- [Dev] php artisan tuklas:launch-check passes.
- [Dev] SSL Labs and securityheaders.com both give the site an A.
- [Dev] Real emails (confirmation, password reset, announcement) arrive in the inbox, not spam.
- [Dev] A restore from the off-server backup works.
- [Dev] The app refuses to start with demo mode on.
- [Dev] PERF-1 to PERF-3 (SRS 5.1) measured and recorded (TBD-8).
