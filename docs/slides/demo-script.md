# Tuklas Live Demo Script

A 10-minute live demonstration of https://junmm.me, done right after the slide presentation, with no
slides on screen. It follows one student's research from a revision to a published work, seen by a
visitor, the student, her adviser and the school. It uses the showcase data as it is right after it's
loaded (tuklas:showcase), so **reset the showcase after every rehearsal**: the demo approves a work, an
educator and an event, and that can't be undone on the live site.

**Who does what:** one **driver** at the laptop, who also holds the phone with the 2FA codes, and one
**narrator**, who speaks the lines in italics and holds the QR card. Swap narrators between parts if
you like.

## Timing

| Time | Part | On screen |
|---|---|---|
| 0:00–0:30 | 1. Opening | The private window |
| 0:30–2:00 | 2. A visitor finds the research | Phone and the private window |
| 2:00–4:30 | 3. The student's side | Andrea Villanueva (student) |
| 4:30–7:15 | 4. The adviser's side | Dr. Maria Santos (educator) |
| 7:15–9:00 | 5. The school's side | Lea Mercado (super-admin) |
| 9:00–9:40 | 6. From defense to discovery | The private window |
| 9:40–10:00 | 7. Closing | The private window |

If you run long, cut in this order: the Research library in part 3, Reports in part 5, the phone scan
in part 2.

## Before the Demonstration (30 Minutes Ahead)

- [ ] The showcase was reset after the last rehearsal (docs/PRODUCTION_SERVER.md, "Showcase data"), and Dr. Santos and Lea have 2FA set up on the driver's phone.
- [ ] A short PDF on the desktop named **Villanueva Chapter 3 draft v2.pdf**.
- [ ] The QR code for work 1 printed on a card, like a research fair poster (tuklas-visitor-qr/work-1-flood-alert-mesh.png). Keep the image open in a background window as a backup.
- [ ] Four browser windows signed in and ready, side by side if the screen allows it: **Andrea** (andrea@tu.junmm.me) in Chrome, **Dr. Santos** (msantos@tu.junmm.me) in Edge or a second Chrome profile, **Lea** (admin@tu.junmm.me) in a third profile, and a **private window**, signed out, on https://junmm.me/works/1.
- [ ] In Andrea's window, open Messages once and allow notifications if the browser asks.
- [ ] Browser zoom at 125% so the room can read it. Other tabs and chat apps closed, and the computer's own notifications off (Do Not Disturb).
- [ ] A phone hotspot ready in case the venue's Wi-Fi fails.
- [ ] A screen recording of a full rehearsal (Windows: Win+Alt+R) saved on the desktop, to play if the site can't be reached.
- [ ] Rehearse once with a timer. Then reset the showcase and sign in the four windows again.

## 1. Opening (0:00–0:30)

The private window is on screen, showing work 1.

*You've seen why Tuklas exists. Now let's see it working. We'll follow one student's research from
her adviser's feedback to a published work that anyone can find, through the eyes of a visitor, the
student, her adviser and the school.*

## 2. A Visitor Finds the Research (0:30–2:00)

1. The narrator holds up the QR card and scans it with a phone. The work opens without signing in.
2. *This is how a visitor arrives: a QR code on a research fair poster, a shared link, or a search engine.*
3. On the laptop, in the private window ("Offline-First Flood Alert Mesh for Barangay Responders"), scroll slowly past the abstract and keywords.
4. Point at **"Defense to Discovery"**: each defense stage with its date, panel and verdict.
5. Point at **"Approval"**: *Only research an adviser or the panel approved is public, with the approver's name on it.*
6. Select **"Cite this"**, choose **APA 7**, and select **"Copy citation"**.
7. *Visitors can read, cite and share. Commenting, following and joining groups need an account.*

## 3. The Student's Side (2:00–4:30)

Switch to **Andrea's** window.

1. **Community feed**: *Andrea sees new research and posts from the people, departments and keywords she follows.*
2. Open **My research**. Point at the statuses: "Predicting First-Year Dropout Risk from LMS Activity Logs" is **submitted** to her adviser, and "Evacuation Route Finder for Barangay Tanods" is still a **draft**.
3. Open **Research groups**, then **Disaster Informatics Lab**. *Her adviser runs the lab as a group: chat channels, shared files and deadlines in one place.*
4. In **#general**, type @, pick **Dr. Maria Santos** from the list, and send: "I've revised Chapter 3, handing it in now."
5. Open the **Deadlines** tab, then **"Chapter 3 (Methodology) draft due"**. Point at the first hand-in and Dr. Santos's feedback: *"Add how you will choose the households, and attach the consent form in Filipino as well."*
6. Select **Choose file** and pick Villanueva Chapter 3 draft v2.pdf. Type the note "Added the household selection and the Filipino consent form." and select **Hand in again**.
7. *Every version is kept with its feedback, and the hand-in is announced in the group's chat.*
8. Optional, if time allows: **Research library**. *The school's approved research, by department.*

Leave Andrea's window visible at the side for part 4.

## 4. The Adviser's Side (4:30–7:15)

Switch to **Dr. Santos's** window.

1. The **bell** shows the mention and the hand-in. *Dr. Santos didn't have to dig through a group chat or her email.*
2. Open **Research groups**, then **Disaster Informatics Lab**, the **Deadlines** tab, and **"Chapter 3 (Methodology) draft due"**.
3. Open Andrea's version 2, write the feedback "Clear sampling plan. Accepted." and select **Accept**.
4. Point at **Andrea's window**: the notification arrives right away. *Updates are live, with no reloading.*
5. Open the **Review board**. *Every work she advises, by stage: awaiting review, under review, needs revision, approved and signed.*
6. Under **"Awaiting review"**, open **"Predicting First-Year Dropout Risk from LMS Activity Logs"**, and select **Start review**. *Andrea is told her adviser is reading it.*
7. Scroll the work briefly, then select **Approve & sign off**. It acts at once, with no confirmation, so click it only here.
8. *It's published immediately, to the feed and to Andrea's portfolio, with Dr. Santos's name as the approver.*

## 5. The School's Side (7:15–9:00)

Switch to **Lea's** window.

*Lea runs the research office. Admins verify people and keep Tuklas academic, and as a super-admin
she oversees every school on the site.*

1. Open **Admin**, then **Educators**, and select **Verify** for Prof. Carla Javier.
2. *Only verified educators can approve research, and each one's rights to publish, moderate groups and post announcements can be switched on or off.*
3. Open **Events** and select **Approve event** for "Literature Colloquium: Writing the Regions". *Educators propose events, and the office approves them before they're listed.*
4. Optional: **Reports**. *Members can report plagiarism or misconduct, and admins decide here.*
5. Open **Schools**. *Tuklas University and Bayan State College share this site. Each school has its own admins, and people who sign up with their school email are placed in it automatically.*

## 6. From Defense to Discovery (9:00–9:40)

Switch to the **private window** and open https://junmm.me/u/andrea.

1. *Andrea's public portfolio now lists the work Dr. Santos approved a few minutes ago, next to her degrees and honors.*
2. Open the work: the abstract, the approval and the citation are there for anyone.
3. *It's also in the site's sitemap, so search engines and Google Scholar can find it.*

## 7. Closing (9:40–10:00)

*That's Tuklas: research moving from draft, to defense, to discovery. It was built with the Data
Privacy Act in mind: two-factor sign-in for advisers and admins, messages encrypted at rest, and every
member can download or delete their own data. Thank you. We're happy to show anything again.*

## If Something Goes Wrong

| Problem | What to do |
|---|---|
| A page is slow or doesn't load | Keep narrating and reload once. Still down: play the rehearsal recording |
| Asked for a 2FA code | The driver reads it from the authenticator app on the phone |
| Signed out (after 120 minutes idle) | Sign in again. That's why the windows are opened only 30 minutes before |
| "Approve & sign off" isn't there | The work was approved in a rehearsal. Say so, and show it on Andrea's portfolio instead |
| The notification doesn't appear in Andrea's window | Reload her window; the bell shows it |
| The phone won't scan the card | Open the backup QR image on screen and scan that, or skip to step 3 of part 2 |

## After the Demonstration

Reset the showcase (docs/PRODUCTION_SERVER.md, "Showcase data") so the site is ready for testing or
the next demonstration, and set up 2FA again for the personas who need it.
