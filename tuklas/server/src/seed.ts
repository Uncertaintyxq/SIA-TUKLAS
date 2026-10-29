/**
 * Demo seed — loads the demo people, works, research groups, announcements and chat.
 * All demo accounts share DEMO_PASSWORD.
 */
import bcrypt from 'bcryptjs';
import type { PrismaClient, Role } from '@prisma/client';

/** Password for every demo account. */
export const DEMO_PASSWORD = 'tuklas123';

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const ahead = (days: number) => new Date(Date.now() + days * DAY);

// Demo people from the prototype. IDs are fixed so the seed is repeatable.
const ANDREA = 1, PAOLO = 2, KIM = 3, SANTOS = 4, AQUINO = 5, LEA = 6, JAVIER = 7;

/**
 * Wipes all app data and loads the prototype's demo people and works.
 * Dates are relative to now, so "approved 12 days ago" stays true.
 * Used by `prisma db seed` and by POST /api/demo/reset.
 */
export async function seedDemo(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Children before parents: works restrict deleting their adviser; thread replies go before the messages they answer.
  await prisma.$transaction([
    prisma.announcementRead.deleteMany(),
    prisma.announcementAttachment.deleteMany(),
    prisma.announcement.deleteMany(),
    prisma.message.deleteMany({ where: { parentId: { not: null } } }),
    prisma.message.deleteMany(),
    prisma.conversationMember.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.groupActivity.deleteMany(),
    prisma.publicationAuthor.deleteMany(),
    prisma.publication.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.groupDeadline.deleteMany(),
    prisma.groupFile.deleteMany(),
    prisma.groupMember.deleteMany(),
    prisma.researchGroup.deleteMany(),
    prisma.ad.deleteMany(),
    prisma.eventRegistration.deleteMany(),
    prisma.event.deleteMany(),
    prisma.opportunityApplication.deleteMany(),
    prisma.opportunity.deleteMany(),
    prisma.savedWork.deleteMany(),
    prisma.reaction.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.revisionItem.deleteMany(),
    prisma.review.deleteMany(),
    prisma.defenseStage.deleteMany(),
    prisma.workVersion.deleteMany(),
    prisma.workAuthor.deleteMany(),
    prisma.work.deleteMany(),
    prisma.academicLink.deleteMany(),
    prisma.profile.deleteMany(),
    prisma.background.deleteMany(),
    prisma.honor.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  await prisma.user.createMany({
    data: [
      { id: ANDREA, name: 'Andrea Villanueva', username: 'andrea', role: 'student', email: 'andrea@tuklas.edu', program: 'BS Computer Science · 4th year', headline: 'Building resilient tech for disaster-prone communities.' },
      { id: PAOLO, name: 'Paolo Reyes', username: 'paolo', role: 'student', email: 'paolo@tuklas.edu', program: 'AB Literature · 3rd year', headline: 'Poet and essayist writing about coastal memory.' },
      { id: KIM, name: 'Kim Dela Cruz', username: 'kim', role: 'student', email: 'kim@tuklas.edu', program: 'BS Biology · 4th year', headline: 'Ethnobotany and natural vector control.' },
      { id: SANTOS, name: 'Dr. Maria Santos', username: 'msantos', role: 'educator', email: 'msantos@tuklas.edu', program: 'Research Adviser · Associate Professor', headline: 'Disaster informatics, applied ML, and mentorship.' },
      { id: AQUINO, name: 'Prof. Ramon Aquino', username: 'raquino', role: 'educator', email: 'raquino@tuklas.edu', program: 'Research Adviser · Assistant Professor', headline: 'Philippine poetics and creative non-fiction.' },
      { id: LEA, name: 'Lea Mercado', username: 'lea', role: 'admin', email: 'admin@tuklas.edu', program: 'Research Publications Officer', headline: 'Keeping Tuklas accurate, fair and academic.' },
      // Signed up as an educator; waits for an admin before she can approve work.
      { id: JAVIER, name: 'Prof. Carla Javier', username: 'cjavier', role: 'educator', verified: false, email: 'cjavier@tuklas.edu', program: 'Instructor · Civil Engineering', headline: 'Water resources and community infrastructure.' },
    ].map((u) => ({ ...u, role: u.role as Role, passwordHash })),
  });

  await prisma.profile.createMany({
    data: [
      { userId: ANDREA, department: 'College of Computing', bioLong: 'I study how low-cost radio networks can keep barangay responders informed when cellular service fails. My thesis grew out of volunteering with our local disaster risk reduction office during Typhoon Odette.\n\nOutside the lab I tutor first-year programming students and help run the campus robotics club.' },
      { userId: PAOLO, department: 'Department of Literature', bioLong: 'I write poems and essays in English and Hiligaynon about fishing families, salt farms and the coastline as a family archive.' },
      { userId: KIM, department: 'Department of Biology', bioLong: 'My research looks at mangrove plants as locally sourced tools for dengue prevention.' },
      { userId: SANTOS, titles: 'PhD', department: 'College of Computing', bioLong: 'I lead the Disaster Informatics Lab, where undergraduate researchers build early-warning and community-mapping systems with local government partners. I have advised more than forty undergraduate theses.\n\nResearch interests: sensor networks, applied machine learning, and fair use of student data.' },
      { userId: AQUINO, titles: 'MFA', department: 'Department of Literature', bioLong: 'Poet and editor of the Tinig student literary folio. I teach creative writing and Philippine poetics.' },
      { userId: LEA, department: 'Office of Research & Publications' },
      { userId: JAVIER, department: 'College of Engineering' },
    ],
  });

  await prisma.academicLink.createMany({
    data: [
      { userId: ANDREA, type: 'orcid', url: 'https://orcid.org/0000-0002-1825-0097' },
      { userId: ANDREA, type: 'linkedin', url: 'https://www.linkedin.com/in/tuklas-demo-andrea' },
      { userId: SANTOS, type: 'scholar', url: 'https://scholar.google.com/citations?user=tuklas-demo' },
      { userId: SANTOS, type: 'researchgate', url: 'https://www.researchgate.net/profile/Tuklas-Demo' },
      { userId: SANTOS, type: 'faculty', url: 'https://example.edu/faculty/msantos' },
    ],
  });

  const T = (...t: string[]) => t;
  const works = [
    { id: 1, authorId: ANDREA, adviserId: SANTOS, type: 'research', title: 'Offline-First Flood Alert Mesh for Barangay Responders',
      abstract: 'We designed and field-tested a LoRa-based mesh network that relays flood-level readings between barangay halls without cellular coverage. Across a six-week pilot in three riverside barangays, alert delivery reached 97.4% with a median latency of 11 seconds, outperforming SMS broadcast during two typhoon events.',
      tags: T('IoT', 'Disaster Risk Reduction', 'LoRa'), status: 'approved', createdAt: ago(40), submittedAt: ago(40), approvedAt: ago(12), approvedById: SANTOS },
    { id: 2, authorId: PAOLO, adviserId: AQUINO, type: 'literary', title: 'Salinlahi: Poems on Coastal Memory',
      abstract: 'A chapbook of fourteen poems in English and Hiligaynon tracing three generations of a fishing family in Iloilo. The collection explores displacement, inherited language and the shoreline as an archive.',
      tags: T('Poetry', 'Hiligaynon', 'Memory'), status: 'approved', createdAt: ago(30), submittedAt: ago(30), approvedAt: ago(6), approvedById: AQUINO },
    { id: 3, authorId: KIM, adviserId: SANTOS, type: 'research', title: 'Mangrove Leaf Extract as a Natural Larvicide Against Aedes aegypti',
      abstract: 'Ethanolic extracts of Rhizophora mucronata leaves were tested on third-instar Aedes aegypti larvae. The LC50 at 24 hours was 412 ppm, suggesting a low-cost, locally sourced complement to chemical larvicides for dengue-endemic communities.',
      tags: T('Public Health', 'Ethnobotany', 'Dengue'), status: 'approved', createdAt: ago(50), submittedAt: ago(50), approvedAt: ago(3), approvedById: LEA },
    { id: 4, authorId: ANDREA, adviserId: SANTOS, type: 'research', title: 'Predicting First-Year Dropout Risk from LMS Activity Logs',
      abstract: 'Using anonymized learning-management-system logs from 2,300 first-year students, we compare gradient boosting and logistic regression for early dropout prediction by week 5 of the semester, with attention to fairness across campuses.',
      tags: T('Machine Learning', 'Education'), status: 'submitted', createdAt: ago(2), submittedAt: ago(2) },
    { id: 5, authorId: PAOLO, adviserId: AQUINO, type: 'literary', title: 'The Weight of Salt (Essay)',
      abstract: 'A personal essay about my grandmother’s salt farm and the slow disappearance of the trade in Guimaras, told through the seasons of a single harvest year.',
      tags: T('Creative Non-fiction'), status: 'revision', createdAt: ago(9), submittedAt: ago(9) },
    { id: 6, authorId: KIM, adviserId: SANTOS, type: 'research', title: 'Microplastic Load in Bivalves Sold at Three Iloilo Wet Markets',
      abstract: 'We quantify microplastic particles in Perna viridis and Crassostrea iredalei purchased from three public markets, identifying polymer types via FTIR spectroscopy.',
      tags: T('Environmental Science', 'Food Safety'), status: 'under_review', createdAt: ago(1), submittedAt: ago(1) },
    { id: 7, authorId: KIM, adviserId: SANTOS, type: 'innovation', title: 'Solar-Powered River Level Sensor Kit for Public Schools',
      abstract: 'An open-hardware kit that lets science classes build, install and maintain a solar-powered ultrasonic river level sensor. Readings feed a classroom dashboard and the barangay flood alert mesh. Twelve teachers piloted the kit across four schools.',
      tags: T('Open Hardware', 'Disaster Risk Reduction', 'STEM Education'), status: 'approved', createdAt: ago(35), submittedAt: ago(35), approvedAt: ago(9), approvedById: SANTOS },
    { id: 8, authorId: ANDREA, adviserId: SANTOS, type: 'innovation', title: 'Evacuation Route Finder for Barangay Tanods',
      abstract: 'A phone app draft that suggests evacuation routes from crowd-reported road blockages during floods. Still being scoped with the barangay DRRM office.',
      tags: T('Mobile', 'Disaster Risk Reduction'), status: 'draft', createdAt: ago(1) },
  ] as const;
  await prisma.work.createMany({ data: works.map((w) => ({ ...w, tags: [...w.tags] })) });
  await prisma.workAuthor.createMany({ data: [{ workId: 7, userId: ANDREA, order: 1 }] });

  await prisma.workVersion.createMany({
    data: works
      .filter((w) => w.status !== 'draft')
      .map((w) => ({ workId: w.id, version: 1, title: w.title, abstract: w.abstract, tags: [...w.tags], submittedAt: w.createdAt })),
  });

  await prisma.review.createMany({
    data: [
      { id: 1, workId: 1, reviewerId: SANTOS, decision: 'start_review', version: 1, createdAt: ago(38) },
      { id: 2, workId: 1, reviewerId: SANTOS, decision: 'approve', comment: 'Excellent field work. Approved for publication.', version: 1, createdAt: ago(12) },
      { id: 3, workId: 2, reviewerId: AQUINO, decision: 'approve', version: 1, createdAt: ago(6) },
      { id: 4, workId: 3, reviewerId: LEA, decision: 'approve', comment: 'Approved by the academic panel.', version: 1, createdAt: ago(3) },
      { id: 5, workId: 5, reviewerId: AQUINO, decision: 'revise', comment: 'The opening is beautiful but the middle section loses the thread. Work through the checklist and resubmit.', version: 1, createdAt: ago(4) },
      { id: 6, workId: 6, reviewerId: SANTOS, decision: 'start_review', version: 1, createdAt: ago(0.5) },
      { id: 7, workId: 7, reviewerId: SANTOS, decision: 'approve', version: 1, createdAt: ago(9) },
    ],
  });
  await prisma.revisionItem.createMany({
    data: [
      { reviewId: 5, text: 'Cut the market scene in the middle section.', doneByStudent: true },
      { reviewId: 5, text: 'Return to the salt beds sooner after the opening.' },
      { reviewId: 5, text: 'Fix the tense shifts in paragraphs 3–5.' },
    ],
  });

  await prisma.defenseStage.createMany({
    data: [
      { workId: 1, stage: 'proposal', date: ago(120), panel: 'Dr. Maria Santos, Engr. Rafael Lim, Dr. Ana Cruz', verdict: 'passed' },
      { workId: 1, stage: 'colloquium', date: ago(60), panel: 'Dr. Maria Santos, Engr. Rafael Lim', verdict: 'passed', notes: 'Presented at the Research Colloquium.' },
      { workId: 1, stage: 'final_defense', date: ago(20), panel: 'Dr. Maria Santos, Engr. Rafael Lim, Dr. Ana Cruz', verdict: 'passed_with_revisions', notes: 'Add the latency distribution chart.' },
      { workId: 1, stage: 'revisions', date: ago(15), panel: 'Dr. Maria Santos', verdict: 'passed', notes: 'Chart added as Appendix C.' },
      { workId: 1, stage: 'published', date: ago(12), panel: 'Dr. Maria Santos', verdict: 'passed', notes: 'Approved and published on Tuklas.' },
      { workId: 4, stage: 'proposal', date: ago(30), panel: 'Dr. Maria Santos, Dr. Ana Cruz', verdict: 'passed' },
      { workId: 4, stage: 'colloquium', date: ahead(10), panel: 'Dr. Maria Santos, Dr. Ana Cruz', verdict: 'pending' },
    ],
  });

  await prisma.comment.createMany({
    data: [
      { workId: 1, authorId: SANTOS, text: 'Strong methodology. Please add the latency distribution chart to the appendix.', createdAt: ago(20) },
      { workId: 1, authorId: ANDREA, text: 'Added as Appendix C. Thank you, Dr. Santos!', createdAt: ago(15) },
      { workId: 5, authorId: AQUINO, text: 'Consider cutting the market scene and returning to the salt beds sooner.', createdAt: ago(4) },
      { workId: 1, authorId: KIM, scope: 'public', text: 'Would love to see this tested in upland barangays too. Our river sensor kit could feed the mesh!', createdAt: ago(10) },
      { workId: 1, authorId: SANTOS, scope: 'public', text: 'The Disaster Informatics Lab is planning exactly that for next semester.', createdAt: ago(9) },
      { workId: 2, authorId: ANDREA, scope: 'public', text: '“The shoreline keeps what we forget” has stayed with me all week.', createdAt: ago(5) },
    ],
  });

  await prisma.reaction.createMany({
    data: [
      { userId: KIM, workId: 1, kind: 'useful' },
      { userId: PAOLO, workId: 1, kind: 'inspiring' },
      { userId: AQUINO, workId: 1, kind: 'insightful' },
      { userId: ANDREA, workId: 2, kind: 'inspiring' },
      { userId: ANDREA, workId: 3, kind: 'insightful' },
    ],
  });
  await prisma.savedWork.createMany({ data: [{ userId: ANDREA, workId: 2 }, { userId: KIM, workId: 1 }] });

  await prisma.opportunity.createMany({
    data: [
      { id: 1, adviserId: SANTOS, kind: 'mentorship', title: 'Undergraduate Research Assistants — Disaster Informatics Lab',
        description: 'Two slots for 3rd–4th year students interested in sensor networks and early-warning systems. Weekly mentorship, co-authorship on publications, and a stipend under the Office of Research.',
        deadline: ahead(18), slots: 2, createdAt: ago(5) },
      { id: 2, adviserId: AQUINO, kind: 'call', title: 'Call for Submissions: Tinig Student Literary Folio, Vol. 7',
        description: 'Poetry, fiction and creative non-fiction in English, Filipino or any Philippine language. Selected works will be published in print and featured on Tuklas portfolios.',
        deadline: ahead(25), slots: null, createdAt: ago(8) },
    ],
  });
  await prisma.opportunityApplication.createMany({
    data: [{ opportunityId: 1, userId: KIM, message: 'I built the river sensor kit and would like to help connect it to the lab’s alert mesh.', createdAt: ago(2) }],
  });

  await prisma.event.createMany({
    data: [
      { id: 1, category: 'colloquium', title: 'Research Colloquium: Data for Disaster Resilience', date: ahead(9), venue: 'AVR 2, Main Building', postedById: SANTOS, status: 'approved', capacity: 80,
        description: 'Student presenters share completed theses on early-warning systems, mapping and community response. Open to all programs.', createdAt: ago(7) },
      { id: 2, category: 'cpgarcia', title: 'C.P. Garcia Event 2026', date: ahead(21), venue: 'University Gymnasium', postedById: LEA, status: 'approved',
        description: 'The annual celebration of scholarship and service, featuring research awards, exhibits and the recognition of outstanding faculty mentors.', createdAt: ago(14) },
      { id: 3, category: 'innovation', title: 'School Innovation Expo', date: ahead(33), venue: 'Engineering Atrium', postedById: LEA, status: 'approved',
        description: 'Prototypes, posters and live demos from capstone teams across engineering, computing and the sciences.', createdAt: ago(10) },
      { id: 4, category: 'colloquium', title: 'Literature Colloquium: Writing the Regions', date: ahead(14), venue: 'Library Function Hall', postedById: AQUINO, status: 'pending',
        description: 'Readings and a panel on writing in regional languages, with student and faculty authors.', createdAt: ago(1) },
      { id: 5, category: 'defense', title: 'Thesis Defense Week: College of Computing', date: ahead(5), venue: 'Computing Building, Rooms 301–304', postedById: SANTOS, status: 'approved', capacity: 120,
        description: 'Final thesis defenses for graduating Computer Science and IT students. Visitors may sit in on any session; the schedule is posted outside each room.', createdAt: ago(6) },
      { id: 6, category: 'fair', title: 'Undergraduate Research Fair', date: ahead(40), venue: 'Library Lobby and Courtyard', postedById: LEA, status: 'approved',
        description: 'A poster fair of approved student research from every college. Each poster carries a QR code so visitors can read the full work on Tuklas.', createdAt: ago(4) },
    ],
  });
  await prisma.eventRegistration.createMany({
    data: [
      { eventId: 1, userId: ANDREA, createdAt: ago(3) },
      { eventId: 1, userId: KIM, createdAt: ago(2) },
      { eventId: 2, userId: PAOLO, createdAt: ago(1) },
    ],
  });
  await prisma.ad.createMany({
    data: [
      { eventId: 2, createdById: LEA, headline: 'Celebrate scholarship and service at the C.P. Garcia Event', startsAt: ago(2), endsAt: ahead(21), status: 'approved' },
      { eventId: 1, createdById: SANTOS, headline: 'See this year’s disaster-resilience theses presented live', startsAt: ago(1), endsAt: ahead(9), status: 'approved' },
      { eventId: 5, createdById: SANTOS, headline: 'Sit in on a thesis defense: open to all students', startsAt: ago(0), endsAt: ahead(5), status: 'pending' },
    ],
  });

  await prisma.researchGroup.create({
    data: {
      id: 1,
      adviserId: SANTOS,
      name: 'Disaster Informatics Lab',
      description: 'Undergraduate researchers building early-warning and community-mapping tools with barangay partners.',
      createdAt: ago(60),
      members: {
        create: [
          { userId: ANDREA, role: 'leader', addedAt: ago(60) },
          { userId: KIM, addedAt: ago(40) },
          { userId: AQUINO, role: 'mentor', addedAt: ago(30) },
        ],
      },
      deadlines: {
        create: [
          { title: 'Lab meeting: bring your progress slides', dueAt: ahead(3) },
          { title: 'Chapter 3 (Methodology) draft due', dueAt: ahead(7) },
        ],
      },
    },
  });

  await prisma.researchGroup.create({
    data: {
      id: 2,
      adviserId: AQUINO,
      name: 'Tinig Writers Circle',
      description: 'Student writers preparing work for the Tinig literary folio, Vol. 7.',
      createdAt: ago(45),
      members: { create: [{ userId: PAOLO, role: 'leader', addedAt: ago(45) }] },
      deadlines: { create: [{ title: 'Folio manuscripts due', dueAt: ahead(25) }] },
    },
  });

  await prisma.background.createMany({
    data: [
      { userId: ANDREA, degree: 'BS Computer Science (in progress)', school: 'University of Iloilo', year: '2027' },
      { userId: ANDREA, degree: 'STEM Strand, Senior High School — With High Honors', school: 'Iloilo National High School', year: '2023' },
      { userId: PAOLO, degree: 'AB Literature (in progress)', school: 'University of Iloilo', year: '2028' },
      { userId: KIM, degree: 'BS Biology (in progress)', school: 'University of Iloilo', year: '2027' },
      { userId: SANTOS, degree: 'PhD Computer Science', school: 'University of the Philippines Diliman', year: '2016' },
      { userId: SANTOS, degree: 'MS Computer Science', school: 'Ateneo de Manila University', year: '2011' },
      { userId: AQUINO, degree: 'MFA Creative Writing', school: 'De La Salle University', year: '2009' },
    ],
  });

  const verified = { verified: true, verifiedById: LEA, verifiedAt: ago(30) };
  await prisma.honor.createMany({
    data: [
      { userId: ANDREA, kind: 'award', title: 'Best Undergraduate Paper — Regional ICT Congress', issuer: 'PSITE Region VI', year: '2026', ...verified },
      { userId: ANDREA, kind: 'grant', title: 'DOST-SEI Undergraduate Scholarship', issuer: 'DOST Science Education Institute', year: '2023', ...verified },
      { userId: ANDREA, kind: 'certification', title: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services', year: '2026' },
      { userId: PAOLO, kind: 'award', title: 'Palanca Awards — Kabataan Essay, 2nd Prize', issuer: 'Carlos Palanca Foundation', year: '2025', ...verified },
      { userId: KIM, kind: 'grant', title: 'Student Research Grant', issuer: 'Office of Research', year: '2026' },
      { userId: SANTOS, kind: 'award', title: 'Outstanding Research Mentor', issuer: 'University of Iloilo', year: '2025', ...verified },
    ],
  });

  await prisma.notification.createMany({
    data: [
      { userId: ANDREA, type: 'group_added', message: 'Dr. Maria Santos added you to the research group “Disaster Informatics Lab”.', link: '/groups/1', createdAt: ago(60), read: true },
      { userId: ANDREA, type: 'work_approved', message: '“Offline-First Flood Alert Mesh for Barangay Responders” was approved by Dr. Maria Santos. It’s now public.', link: '/works/1', createdAt: ago(12), read: true },
      { userId: ANDREA, type: 'work_comment', message: 'Kim Dela Cruz commented on your published work “Offline-First Flood Alert Mesh for Barangay Responders”.', link: '/works/1#discussion', createdAt: ago(10) },
      { userId: ANDREA, type: 'group_deadline', message: 'New deadline in “Disaster Informatics Lab”: Chapter 3 (Methodology) draft due.', link: '/groups/1', createdAt: ago(1) },
      { userId: PAOLO, type: 'work_revision', message: 'Prof. Ramon Aquino returned “The Weight of Salt (Essay)” with comments. Revise and resubmit.', link: '/works/5', createdAt: ago(4) },
      { userId: KIM, type: 'work_under_review', message: 'Dr. Maria Santos started reviewing “Microplastic Load in Bivalves Sold at Three Iloilo Wet Markets”.', link: '/works/6', createdAt: ago(0.5) },
      { userId: SANTOS, type: 'work_submitted', message: 'Andrea Villanueva submitted “Predicting First-Year Dropout Risk from LMS Activity Logs” for review.', link: '/works/4', createdAt: ago(2) },
      { userId: SANTOS, type: 'opportunity_application', message: 'Kim Dela Cruz applied to “Undergraduate Research Assistants — Disaster Informatics Lab”.', link: '/post', createdAt: ago(2) },
      { userId: LEA, type: 'educator_signup', message: 'Prof. Carla Javier signed up as an educator and is waiting for verification.', link: '/admin?tab=educators', createdAt: ago(1) },
      { userId: LEA, type: 'event_proposed', message: 'Prof. Ramon Aquino proposed “Literature Colloquium: Writing the Regions” and it needs approval.', link: '/admin?tab=events', createdAt: ago(1) },
      { userId: LEA, type: 'ad_requested', message: 'Dr. Maria Santos requested an ad slot for “Thesis Defense Week: College of Computing”.', link: '/admin?tab=ads', createdAt: ago(0) },
    ],
  });

  await seedCollaboration(prisma);
}

const HOUR = 3_600_000;
const hoursAgo = (h: number) => new Date(Date.now() - h * HOUR);

/**
 * Demo content for educator research, announcements and chat. Runs at the end of seedDemo, and can be run
 * on its own against a database that already has the demo people (it skips groups that don't exist).
 */
export async function seedCollaboration(prisma: PrismaClient): Promise<void> {
  const groups = await prisma.researchGroup.findMany({ where: { id: { in: [1, 2] } }, include: { members: { select: { userId: true } } } });
  const lab = groups.find((g) => g.id === 1);
  const circle = groups.find((g) => g.id === 2);
  const everyoneIn = (g: { adviserId: number; members: { userId: number }[] }) => [g.adviserId, ...g.members.map((m) => m.userId)];

  // ---------- Educator research ----------
  const K = (...k: string[]) => k;
  await prisma.publication.createMany({
    data: [
      { id: 1, authorId: SANTOS, visibility: 'public', publishedAt: ago(20), createdAt: ago(34),
        title: 'Community-Based Flood Early Warning: Lessons from Five Years of Barangay Partnerships',
        abstract: 'Between 2021 and 2026 the Disaster Informatics Lab co-designed flood early-warning tools with eleven riverside barangays. This paper reports what made the systems last: local ownership of sensors, alert wording tested with residents, and redundancy over sophistication. We find that alert trust, not technical accuracy, best predicted evacuation compliance.',
        keywords: K('Disaster Risk Reduction', 'Early Warning Systems', 'Community Engagement'),
        methodology: 'A multi-site case study across eleven barangays in Iloilo. We combined sensor logs (2021–2026), 64 semi-structured interviews with barangay officials and residents, and household surveys after three typhoon seasons (n = 912). Interviews were coded thematically by two researchers; survey data were analysed with mixed-effects logistic regression on evacuation compliance.',
        fullText: 'Introduction\n\nEarly-warning systems often fail after the project that installed them ends. We asked a simpler question than most evaluations: which systems were still trusted and used five years later?\n\nFindings\n\nThree factors separated lasting systems from abandoned ones. First, barangay responders, not the university, owned and maintained the sensors. Second, alert messages were written and tested with residents in Hiligaynon. Third, every system had a low-tech fallback: a siren, a bell, or a runner.\n\nConclusion\n\nCommunities kept the systems they understood. Researchers designing early-warning tools should budget as much time for alert wording and handover as for hardware.' },
      { id: 2, authorId: SANTOS, visibility: 'internal', publishedAt: ago(8), createdAt: ago(12),
        title: 'Fairness Audits for Early-Dropout Prediction Models in Philippine State Universities',
        abstract: 'Dropout prediction models are spreading across campuses, but few are checked for unequal error rates. We propose a lightweight audit protocol for registrars and test it on two anonymised cohorts, showing that a model with high overall accuracy missed at-risk students from satellite campuses twice as often.',
        keywords: K('Machine Learning', 'Fairness', 'Higher Education'),
        methodology: 'Retrospective analysis of anonymised learning-management-system logs from two cohorts (2,300 and 2,140 first-year students). We compared false-negative rates across campus, program and scholarship status, with bootstrap confidence intervals.',
        fullText: 'This internal report is shared with university offices only. It summarises the audit protocol and the results for the two cohorts, and recommends that any dropout model be audited each semester before it is used to allocate support.' },
      { id: 3, authorId: SANTOS, visibility: 'draft', createdAt: ago(2),
        title: 'Low-Power LoRa Mesh Routing for Upland Barangays (working paper)',
        abstract: 'A working paper on adapting the flood alert mesh to upland terrain, where line-of-sight between barangay halls is rare and solar charging is unreliable during the rainy season.',
        keywords: K('LoRa', 'IoT', 'Mesh Networks'),
        methodology: 'Planned: field tests in two upland barangays over one rainy season.', fullText: '' },
      { id: 4, authorId: AQUINO, visibility: 'public', publishedAt: ago(15), createdAt: ago(25),
        title: 'Writing the Shoreline: Hiligaynon Poetics and Coastal Memory',
        abstract: 'An essay on how contemporary Hiligaynon poets write the coast as an archive of family and labour, and what this means for teaching regional literature in the university classroom.',
        keywords: K('Poetry', 'Hiligaynon', 'Regional Literature'),
        methodology: 'Close reading of 42 poems published in regional folios between 2010 and 2025, with interviews of six poets.',
        fullText: 'The shoreline in Hiligaynon poetry is rarely scenery. It is a ledger of who left, who stayed, and what the sea took.\n\nThis essay reads the coast as an archive, and argues that student writers should be taught to read their own places the same way.' },
      { id: 5, authorId: AQUINO, visibility: 'internal', publishedAt: ago(4), createdAt: ago(6),
        title: 'Teaching Creative Non-fiction with Community Oral Histories',
        abstract: 'A teaching note on a semester-long assignment in which students record and transcribe an elder’s oral history, then shape it into creative non-fiction with the elder’s consent and review.',
        keywords: K('Pedagogy', 'Creative Non-fiction', 'Oral History'),
        methodology: 'Reflective teaching practice across three sections (n = 74 students), with student reflections and consent records.', fullText: '' },
    ],
  });
  await prisma.publicationAuthor.createMany({ data: [{ publicationId: 1, userId: ANDREA, order: 1 }] });

  // ---------- Announcements ----------
  await prisma.announcement.createMany({
    data: [
      { id: 1, authorId: LEA, scope: 'system', pinned: true, createdAt: ago(2),
        title: 'Undergraduate Research Fair: poster submissions are open',
        body: 'The **Undergraduate Research Fair** is on its way, and every approved work on Tuklas can take part.\n\n## How to join\n- Make sure your work is **approved** on Tuklas\n- Upload your poster PDF to your work page\n- Register for the fair under _Academic events_\n\nPosters are due two weeks before the fair. Questions? Message the Office of Research & Publications.' },
      { id: 2, authorId: LEA, scope: 'system', createdAt: ago(6),
        title: 'Scheduled maintenance this Saturday, 8–10 AM',
        body: 'Tuklas will be read-only on **Saturday from 8 to 10 AM** while we update the servers. Drafts you save before then are safe.' },
      { id: 3, authorId: SANTOS, scope: 'department', department: 'College of Computing', createdAt: ago(1),
        title: 'Thesis defense schedule for the College of Computing is posted',
        body: 'The final defense schedule is now up. Please check your slot and room:\n\n1. Rooms 301–304, Computing Building\n2. 30 minutes per group, plus 15 minutes for questions\n3. Bring three printed copies for the panel\n\nSee the _Thesis Defense Week_ event for details.' },
    ],
  });
  const reads = [
    { announcementId: 1, userId: KIM, readAt: hoursAgo(30) },
    { announcementId: 1, userId: PAOLO, readAt: hoursAgo(20) },
    { announcementId: 2, userId: ANDREA, readAt: hoursAgo(100) },
    { announcementId: 2, userId: KIM, readAt: hoursAgo(90) },
  ];
  if (lab) {
    await prisma.announcement.create({
      data: { id: 4, authorId: SANTOS, scope: 'group', groupId: lab.id, pinned: true, createdAt: hoursAgo(5),
        title: 'Lab meeting moved to Thursday, 3 PM',
        body: 'This week’s lab meeting moves to **Thursday at 3 PM** in the Disaster Informatics Lab. Bring your progress slides and one question you’re stuck on.' },
    });
    if (lab.members.some((m) => m.userId === KIM)) reads.push({ announcementId: 4, userId: KIM, readAt: hoursAgo(3) });
  }
  if (circle) {
    await prisma.announcement.create({
      data: { id: 5, authorId: AQUINO, scope: 'group', groupId: circle.id, createdAt: hoursAgo(26),
        title: 'Workshop: revising the middle of an essay',
        body: 'Next session we’ll workshop the middle sections of your essays. Bring a printed draft and mark the paragraph where you think the thread gets lost.' },
    });
  }
  await prisma.announcementRead.createMany({ data: reads });

  // ---------- Chat ----------
  type Line = [senderId: number, hoursBack: number, text: string];
  async function conversation(data: { kind: 'direct' | 'channel'; directKey?: string; groupId?: number; name?: string }, memberIds: number[], lines: Line[], readUpTo: Record<number, number> = {}) {
    const last = lines.length ? Math.min(...lines.map((l) => l[1])) : 0;
    const c = await prisma.conversation.create({ data: { ...data, lastMessageAt: hoursAgo(last), createdAt: hoursAgo(Math.max(...lines.map((l) => l[1]), 0) + 1) } });
    // Everyone has read everything unless readUpTo says how many hours back they stopped.
    await prisma.conversationMember.createMany({
      data: [...new Set(memberIds)].map((userId) => ({ conversationId: c.id, userId, lastReadAt: readUpTo[userId] !== undefined ? hoursAgo(readUpTo[userId]) : new Date() })),
    });
    const ids: number[] = [];
    for (const [senderId, h, text] of lines) {
      const m = await prisma.message.create({ data: { conversationId: c.id, senderId, text, createdAt: hoursAgo(h) } });
      ids.push(m.id);
    }
    return { conversation: c, ids };
  }
  async function replies(conversationId: number, parentId: number, lines: Line[]) {
    for (const [senderId, h, text] of lines) await prisma.message.create({ data: { conversationId, parentId, senderId, text, createdAt: hoursAgo(h) } });
  }

  await conversation({ kind: 'direct', directKey: `${ANDREA}:${KIM}` }, [ANDREA, KIM], [
    [KIM, 30, 'Hi Andrea! Saw your comment on the flood mesh. Want to try feeding my river sensor readings into it?'],
    [ANDREA, 29, 'Yes! The mesh accepts any reading over LoRa. What’s your sensor’s update interval?'],
    [KIM, 28.5, 'Every 5 minutes, every minute during heavy rain.'],
    [ANDREA, 28, 'Perfect, that fits. Let’s test at the lab on Thursday after the meeting.'],
    [KIM, 1.5, 'Bringing two kits on Thursday. Can you bring the gateway?'],
  ], { [ANDREA]: 2 });

  await conversation({ kind: 'direct', directKey: `${ANDREA}:${SANTOS}` }, [ANDREA, SANTOS], [
    [ANDREA, 50, 'Good afternoon, Dr. Santos. I uploaded my Chapter 3 draft to the lab’s files. Could you check the sampling section?'],
    [SANTOS, 47, 'Thanks, Andrea. I’ll read it tonight. Make sure you justify why you chose three barangays and not five.'],
    [ANDREA, 46, 'Noted, I’ll add that to 3.2. Thank you!'],
  ]);

  await conversation({ kind: 'direct', directKey: `${SANTOS}:${AQUINO}` }, [SANTOS, AQUINO], [
    [SANTOS, 72, 'Ramon, would you mentor the lab on writing for non-specialist readers? Our alert messages need a writer’s ear.'],
    [AQUINO, 70, 'Happy to. Add me to the group and I’ll run a session on plain-language alerts.'],
    [SANTOS, 69, 'Done. Thank you!'],
  ]);

  if (lab) {
    const members = everyoneIn(lab);
    const has = (id: number) => members.includes(id);
    const say = (lines: Line[]) => lines.filter(([sender]) => has(sender));
    await conversation({ kind: 'channel', groupId: lab.id, name: 'general' }, members, say([
      [SANTOS, 26, 'Welcome back, everyone. Lab meeting moves to Thursday this week (see the announcement).'],
      [ANDREA, 25, 'Got it. I’ll present the mesh latency results.'],
      [KIM, 24, 'I’ll bring the river sensor kits for a live demo.'],
      [AQUINO, 6, 'Looking forward to it. I’ll bring examples of alert messages that residents found clear.'],
    ]), { [ANDREA]: 7 });
    const methods = await conversation({ kind: 'channel', groupId: lab.id, name: 'chapter-3-methods' }, members, say([
      [ANDREA, 52, 'Chapter 3 outline is in the files. Comments welcome before Friday.'],
      [KIM, 20, 'Question: do we report the sensor calibration in Methods or in an appendix?'],
    ]));
    const question = methods.ids.at(-1);
    if (question && has(KIM)) {
      await replies(methods.conversation.id, question, say([
        [SANTOS, 19, 'Summarise it in Methods (one paragraph) and put the full calibration table in an appendix.'],
        [ANDREA, 18.5, 'I’ll do the same for the gateway settings.'],
      ]));
    }
    await prisma.groupActivity.createMany({
      data: [
        { groupId: lab.id, actorId: SANTOS, action: 'channel_created', detail: 'Dr. Maria Santos opened #chapter-3-methods.', createdAt: ago(3) },
        { groupId: lab.id, actorId: SANTOS, action: 'deadline_added', detail: 'Dr. Maria Santos added the deadline “Chapter 3 (Methodology) draft due”.', createdAt: ago(1) },
        { groupId: lab.id, actorId: SANTOS, action: 'announcement_posted', detail: 'Dr. Maria Santos posted “Lab meeting moved to Thursday, 3 PM”.', createdAt: hoursAgo(5) },
      ],
    });
  }

  if (circle) {
    await conversation({ kind: 'channel', groupId: circle.id, name: 'general' }, everyoneIn(circle), [
      [AQUINO, 40, 'Folio manuscripts are due in three weeks. Post questions here.'],
      [PAOLO, 38, 'Sir, can essays go over 3,000 words if the folio editor agrees?'],
      [AQUINO, 37, 'Yes, up to 4,000 with the editor’s approval.'],
    ]);
    await prisma.groupActivity.createMany({
      data: [
        { groupId: circle.id, actorId: AQUINO, action: 'group_created', detail: 'Prof. Ramon Aquino started the group.', createdAt: ago(45) },
        { groupId: circle.id, actorId: AQUINO, action: 'member_added', detail: 'Prof. Ramon Aquino added Paolo Reyes as group leader.', createdAt: ago(45) },
      ],
    });
  }

  await prisma.notification.createMany({
    data: [
      { userId: ANDREA, type: 'announcement', message: 'Lea Mercado posted an announcement: “Undergraduate Research Fair: poster submissions are open”', link: '/announcements#a-1', createdAt: ago(2) },
      { userId: ANDREA, type: 'announcement', message: 'Dr. Maria Santos posted an announcement: “Thesis defense schedule for the College of Computing is posted”', link: '/announcements#a-3', createdAt: ago(1) },
    ],
  });
}
