<?php

namespace Database\Seeders;

use App\Models\AcademicLink;
use App\Models\Ad;
use App\Models\Announcement;
use App\Models\Background;
use App\Models\Comment;
use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\DefenseStage;
use App\Models\Event;
use App\Models\GroupActivity;
use App\Models\GroupDeadline;
use App\Models\GroupMember;
use App\Models\Honor;
use App\Models\Message;
use App\Models\Notification;
use App\Models\Opportunity;
use App\Models\OpportunityApplication;
use App\Models\Profile;
use App\Models\Publication;
use App\Models\Reaction;
use App\Models\ResearchGroup;
use App\Models\Review;
use App\Models\RevisionItem;
use App\Models\User;
use App\Models\Work;
use App\Models\WorkVersion;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Wipes all app data and loads the prototype's demo people, works, groups, announcements and chat.
 * Dates are relative to now, so "approved 12 days ago" stays true. IDs are fixed so the seed is
 * repeatable. Used by `php artisan db:seed` and by POST /api/demo/reset.
 */
class DemoSeeder extends Seeder
{
    /** Password for every demo account. */
    public const PASSWORD = 'tuklas123';

    private const ANDREA = 1;

    private const PAOLO = 2;

    private const KIM = 3;

    private const SANTOS = 4;

    private const AQUINO = 5;

    private const LEA = 6;

    private const JAVIER = 7;

    /** App tables, emptied before seeding, children before parents. Laravel's own tables (sessions, cache, jobs) are kept. */
    public const TABLES = [
        'announcement_reads', 'announcement_attachments', 'announcements', 'messages', 'conversation_members',
        'conversations', 'group_activities', 'publication_authors', 'publications', 'notifications', 'group_deadlines',
        'group_files', 'group_members', 'research_groups', 'ads', 'event_registrations', 'events',
        'opportunity_applications', 'opportunities', 'saved_works', 'reactions', 'comments', 'revision_items',
        'reviews', 'defense_stages', 'work_versions', 'work_authors', 'works', 'academic_links', 'profiles',
        'backgrounds', 'honors', 'audit_logs', 'password_reset_tokens', 'users',
    ];

    private CarbonImmutable $now;

    public function run(): void
    {
        $this->now = CarbonImmutable::now();

        Model::unguarded(function () {
            DB::transaction(function () {
                $this->wipe();
                $this->people();
                $this->works();
                $this->feedAndEvents();
                $this->groups();
                $this->portfolios();
                $this->notifications();
                $this->publications();
                $this->announcements();
                $this->chat();
            });
        });
    }

    private function ago(float $days): CarbonImmutable
    {
        return $this->now->subSeconds((int) round($days * 86400));
    }

    private function ahead(float $days): CarbonImmutable
    {
        return $this->now->addSeconds((int) round($days * 86400));
    }

    private function hoursAgo(float $hours): CarbonImmutable
    {
        return $this->now->subSeconds((int) round($hours * 3600));
    }

    /**
     * DELETE, not TRUNCATE: TRUNCATE commits the transaction on MySQL. TABLES is ordered children
     * first, so foreign keys hold at every step.
     */
    private function wipe(): void
    {
        foreach (self::TABLES as $table) {
            DB::table($table)->delete();
        }
    }

    private function people(): void
    {
        $password = Hash::make(self::PASSWORD);
        $people = [
            [self::ANDREA, 'Andrea Villanueva', 'andrea', 'student', 'andrea@tuklas.edu', 'BS Computer Science · 4th year', 'Building resilient tech for disaster-prone communities.'],
            [self::PAOLO, 'Paolo Reyes', 'paolo', 'student', 'paolo@tuklas.edu', 'AB Literature · 3rd year', 'Poet and essayist writing about coastal memory.'],
            [self::KIM, 'Kim Dela Cruz', 'kim', 'student', 'kim@tuklas.edu', 'BS Biology · 4th year', 'Ethnobotany and natural vector control.'],
            [self::SANTOS, 'Dr. Maria Santos', 'msantos', 'educator', 'msantos@tuklas.edu', 'Research Adviser · Associate Professor', 'Disaster informatics, applied ML, and mentorship.'],
            [self::AQUINO, 'Prof. Ramon Aquino', 'raquino', 'educator', 'raquino@tuklas.edu', 'Research Adviser · Assistant Professor', 'Philippine poetics and creative non-fiction.'],
            [self::LEA, 'Lea Mercado', 'lea', 'admin', 'admin@tuklas.edu', 'Research Publications Officer', 'Keeping Tuklas accurate, fair and academic.'],
            // Signed up as an educator; waits for an admin before she can approve work.
            [self::JAVIER, 'Prof. Carla Javier', 'cjavier', 'educator', 'cjavier@tuklas.edu', 'Instructor · Civil Engineering', 'Water resources and community infrastructure.'],
        ];
        foreach ($people as [$id, $name, $username, $role, $email, $program, $headline]) {
            User::create([
                'id' => $id, 'name' => $name, 'username' => $username, 'role' => $role, 'email' => $email,
                'program' => $program, 'headline' => $headline, 'password' => $password,
                'verified' => $id !== self::JAVIER, 'email_verified_at' => $this->now,
                'privacy_accepted_at' => $this->now, 'privacy_version' => config('tuklas.privacy_version'),
            ]);
        }

        $profiles = [
            self::ANDREA => ['', 'College of Computing', "I study how low-cost radio networks can keep barangay responders informed when cellular service fails. My thesis grew out of volunteering with our local disaster risk reduction office during Typhoon Odette.\n\nOutside the lab I tutor first-year programming students and help run the campus robotics club."],
            self::PAOLO => ['', 'Department of Literature', 'I write poems and essays in English and Hiligaynon about fishing families, salt farms and the coastline as a family archive.'],
            self::KIM => ['', 'Department of Biology', 'My research looks at mangrove plants as locally sourced tools for dengue prevention.'],
            self::SANTOS => ['PhD', 'College of Computing', "I lead the Disaster Informatics Lab, where undergraduate researchers build early-warning and community-mapping systems with local government partners. I have advised more than forty undergraduate theses.\n\nResearch interests: sensor networks, applied machine learning, and fair use of student data."],
            self::AQUINO => ['MFA', 'Department of Literature', 'Poet and editor of the Tinig student literary folio. I teach creative writing and Philippine poetics.'],
            self::LEA => ['', 'Office of Research & Publications', null],
            self::JAVIER => ['', 'College of Engineering', null],
        ];
        foreach ($profiles as $userId => [$titles, $department, $bio]) {
            Profile::create(['user_id' => $userId, 'titles' => $titles, 'department' => $department, 'bio_long' => $bio]);
        }

        foreach ([
            [self::ANDREA, 'orcid', 'https://orcid.org/0000-0002-1825-0097'],
            [self::ANDREA, 'linkedin', 'https://www.linkedin.com/in/tuklas-demo-andrea'],
            [self::SANTOS, 'scholar', 'https://scholar.google.com/citations?user=tuklas-demo'],
            [self::SANTOS, 'researchgate', 'https://www.researchgate.net/profile/Tuklas-Demo'],
            [self::SANTOS, 'faculty', 'https://example.edu/faculty/msantos'],
        ] as [$userId, $type, $url]) {
            AcademicLink::create(['user_id' => $userId, 'type' => $type, 'url' => $url]);
        }
    }

    private function works(): void
    {
        $works = [
            [1, self::ANDREA, self::SANTOS, 'research', 'Offline-First Flood Alert Mesh for Barangay Responders',
                'We designed and field-tested a LoRa-based mesh network that relays flood-level readings between barangay halls without cellular coverage. Across a six-week pilot in three riverside barangays, alert delivery reached 97.4% with a median latency of 11 seconds, outperforming SMS broadcast during two typhoon events.',
                ['IoT', 'Disaster Risk Reduction', 'LoRa'], 'approved', 40, 12, self::SANTOS],
            [2, self::PAOLO, self::AQUINO, 'literary', 'Salinlahi: Poems on Coastal Memory',
                'A chapbook of fourteen poems in English and Hiligaynon tracing three generations of a fishing family in Iloilo. The collection explores displacement, inherited language and the shoreline as an archive.',
                ['Poetry', 'Hiligaynon', 'Memory'], 'approved', 30, 6, self::AQUINO],
            [3, self::KIM, self::SANTOS, 'research', 'Mangrove Leaf Extract as a Natural Larvicide Against Aedes aegypti',
                'Ethanolic extracts of Rhizophora mucronata leaves were tested on third-instar Aedes aegypti larvae. The LC50 at 24 hours was 412 ppm, suggesting a low-cost, locally sourced complement to chemical larvicides for dengue-endemic communities.',
                ['Public Health', 'Ethnobotany', 'Dengue'], 'approved', 50, 3, self::LEA],
            [4, self::ANDREA, self::SANTOS, 'research', 'Predicting First-Year Dropout Risk from LMS Activity Logs',
                'Using anonymized learning-management-system logs from 2,300 first-year students, we compare gradient boosting and logistic regression for early dropout prediction by week 5 of the semester, with attention to fairness across campuses.',
                ['Machine Learning', 'Education'], 'submitted', 2, null, null],
            [5, self::PAOLO, self::AQUINO, 'literary', 'The Weight of Salt (Essay)',
                'A personal essay about my grandmother’s salt farm and the slow disappearance of the trade in Guimaras, told through the seasons of a single harvest year.',
                ['Creative Non-fiction'], 'revision', 9, null, null],
            [6, self::KIM, self::SANTOS, 'research', 'Microplastic Load in Bivalves Sold at Three Iloilo Wet Markets',
                'We quantify microplastic particles in Perna viridis and Crassostrea iredalei purchased from three public markets, identifying polymer types via FTIR spectroscopy.',
                ['Environmental Science', 'Food Safety'], 'under_review', 1, null, null],
            [7, self::KIM, self::SANTOS, 'innovation', 'Solar-Powered River Level Sensor Kit for Public Schools',
                'An open-hardware kit that lets science classes build, install and maintain a solar-powered ultrasonic river level sensor. Readings feed a classroom dashboard and the barangay flood alert mesh. Twelve teachers piloted the kit across four schools.',
                ['Open Hardware', 'Disaster Risk Reduction', 'STEM Education'], 'approved', 35, 9, self::SANTOS],
            [8, self::ANDREA, self::SANTOS, 'innovation', 'Evacuation Route Finder for Barangay Tanods',
                'A phone app draft that suggests evacuation routes from crowd-reported road blockages during floods. Still being scoped with the barangay DRRM office.',
                ['Mobile', 'Disaster Risk Reduction'], 'draft', 1, null, null],
        ];
        foreach ($works as [$id, $author, $adviser, $type, $title, $abstract, $tags, $status, $createdDaysAgo, $approvedDaysAgo, $approvedBy]) {
            $created = $this->ago($createdDaysAgo);
            Work::create([
                'id' => $id, 'author_id' => $author, 'adviser_id' => $adviser, 'type' => $type, 'title' => $title,
                'abstract' => $abstract, 'tags' => $tags, 'status' => $status, 'created_at' => $created, 'updated_at' => $created,
                'submitted_at' => $status === 'draft' ? null : $created,
                'approved_at' => $approvedDaysAgo === null ? null : $this->ago($approvedDaysAgo),
                'approved_by_id' => $approvedBy,
            ]);
            if ($status !== 'draft') {
                WorkVersion::create(['work_id' => $id, 'version' => 1, 'title' => $title, 'abstract' => $abstract, 'tags' => $tags, 'submitted_at' => $created]);
            }
        }
        DB::table('work_authors')->insert(['work_id' => 7, 'user_id' => self::ANDREA, 'order' => 1]);

        foreach ([
            [1, 1, self::SANTOS, 'start_review', null, 38],
            [2, 1, self::SANTOS, 'approve', 'Excellent field work. Approved for publication.', 12],
            [3, 2, self::AQUINO, 'approve', null, 6],
            [4, 3, self::LEA, 'approve', 'Approved by the academic panel.', 3],
            [5, 5, self::AQUINO, 'revise', 'The opening is beautiful but the middle section loses the thread. Work through the checklist and resubmit.', 4],
            [6, 6, self::SANTOS, 'start_review', null, 0.5],
            [7, 7, self::SANTOS, 'approve', null, 9],
        ] as [$id, $work, $reviewer, $decision, $comment, $daysAgo]) {
            Review::create(['id' => $id, 'work_id' => $work, 'reviewer_id' => $reviewer, 'decision' => $decision, 'comment' => $comment, 'version' => 1, 'created_at' => $this->ago($daysAgo)]);
        }
        foreach ([
            ['Cut the market scene in the middle section.', true],
            ['Return to the salt beds sooner after the opening.', false],
            ['Fix the tense shifts in paragraphs 3–5.', false],
        ] as [$text, $done]) {
            RevisionItem::create(['review_id' => 5, 'text' => $text, 'done_by_student' => $done]);
        }

        foreach ([
            [1, 'proposal', -120, 'Dr. Maria Santos, Engr. Rafael Lim, Dr. Ana Cruz', 'passed', ''],
            [1, 'colloquium', -60, 'Dr. Maria Santos, Engr. Rafael Lim', 'passed', 'Presented at the Research Colloquium.'],
            [1, 'final_defense', -20, 'Dr. Maria Santos, Engr. Rafael Lim, Dr. Ana Cruz', 'passed_with_revisions', 'Add the latency distribution chart.'],
            [1, 'revisions', -15, 'Dr. Maria Santos', 'passed', 'Chart added as Appendix C.'],
            [1, 'published', -12, 'Dr. Maria Santos', 'passed', 'Approved and published on Tuklas.'],
            [4, 'proposal', -30, 'Dr. Maria Santos, Dr. Ana Cruz', 'passed', ''],
            [4, 'colloquium', 10, 'Dr. Maria Santos, Dr. Ana Cruz', 'pending', ''],
        ] as [$work, $stage, $days, $panel, $verdict, $notes]) {
            DefenseStage::create(['work_id' => $work, 'stage' => $stage, 'date' => $days < 0 ? $this->ago(-$days) : $this->ahead($days), 'panel' => $panel, 'verdict' => $verdict, 'notes' => $notes]);
        }

        foreach ([
            [1, self::SANTOS, 'review', 'Strong methodology. Please add the latency distribution chart to the appendix.', 20],
            [1, self::ANDREA, 'review', 'Added as Appendix C. Thank you, Dr. Santos!', 15],
            [5, self::AQUINO, 'review', 'Consider cutting the market scene and returning to the salt beds sooner.', 4],
            [1, self::KIM, 'public', 'Would love to see this tested in upland barangays too. Our river sensor kit could feed the mesh!', 10],
            [1, self::SANTOS, 'public', 'The Disaster Informatics Lab is planning exactly that for next semester.', 9],
            [2, self::ANDREA, 'public', '“The shoreline keeps what we forget” has stayed with me all week.', 5],
        ] as [$work, $author, $scope, $text, $daysAgo]) {
            Comment::create(['work_id' => $work, 'author_id' => $author, 'scope' => $scope, 'text' => $text, 'created_at' => $this->ago($daysAgo)]);
        }

        foreach ([[self::KIM, 1, 'useful'], [self::PAOLO, 1, 'inspiring'], [self::AQUINO, 1, 'insightful'], [self::ANDREA, 2, 'inspiring'], [self::ANDREA, 3, 'insightful']] as [$user, $work, $kind]) {
            Reaction::create(['user_id' => $user, 'work_id' => $work, 'kind' => $kind]);
        }
        DB::table('saved_works')->insert([
            ['user_id' => self::ANDREA, 'work_id' => 2, 'created_at' => $this->now],
            ['user_id' => self::KIM, 'work_id' => 1, 'created_at' => $this->now],
        ]);
    }

    private function feedAndEvents(): void
    {
        Opportunity::create(['id' => 1, 'adviser_id' => self::SANTOS, 'kind' => 'mentorship', 'title' => 'Undergraduate Research Assistants — Disaster Informatics Lab',
            'description' => 'Two slots for 3rd–4th year students interested in sensor networks and early-warning systems. Weekly mentorship, co-authorship on publications, and a stipend under the Office of Research.',
            'deadline' => $this->ahead(18), 'slots' => 2, 'created_at' => $this->ago(5)]);
        Opportunity::create(['id' => 2, 'adviser_id' => self::AQUINO, 'kind' => 'call', 'title' => 'Call for Submissions: Tinig Student Literary Folio, Vol. 7',
            'description' => 'Poetry, fiction and creative non-fiction in English, Filipino or any Philippine language. Selected works will be published in print and featured on Tuklas portfolios.',
            'deadline' => $this->ahead(25), 'slots' => null, 'created_at' => $this->ago(8)]);
        OpportunityApplication::create(['opportunity_id' => 1, 'user_id' => self::KIM, 'message' => 'I built the river sensor kit and would like to help connect it to the lab’s alert mesh.', 'created_at' => $this->ago(2)]);

        foreach ([
            [1, 'colloquium', 'Research Colloquium: Data for Disaster Resilience', 9, 'AVR 2, Main Building', self::SANTOS, 'approved', 80,
                'Student presenters share completed theses on early-warning systems, mapping and community response. Open to all programs.', 7],
            [2, 'cpgarcia', 'C.P. Garcia Event 2026', 21, 'University Gymnasium', self::LEA, 'approved', null,
                'The annual celebration of scholarship and service, featuring research awards, exhibits and the recognition of outstanding faculty mentors.', 14],
            [3, 'innovation', 'School Innovation Expo', 33, 'Engineering Atrium', self::LEA, 'approved', null,
                'Prototypes, posters and live demos from capstone teams across engineering, computing and the sciences.', 10],
            [4, 'colloquium', 'Literature Colloquium: Writing the Regions', 14, 'Library Function Hall', self::AQUINO, 'pending', null,
                'Readings and a panel on writing in regional languages, with student and faculty authors.', 1],
            [5, 'defense', 'Thesis Defense Week: College of Computing', 5, 'Computing Building, Rooms 301–304', self::SANTOS, 'approved', 120,
                'Final thesis defenses for graduating Computer Science and IT students. Visitors may sit in on any session; the schedule is posted outside each room.', 6],
            [6, 'fair', 'Undergraduate Research Fair', 40, 'Library Lobby and Courtyard', self::LEA, 'approved', null,
                'A poster fair of approved student research from every college. Each poster carries a QR code so visitors can read the full work on Tuklas.', 4],
        ] as [$id, $category, $title, $inDays, $venue, $postedBy, $status, $capacity, $description, $createdDaysAgo]) {
            Event::create(['id' => $id, 'category' => $category, 'title' => $title, 'date' => $this->ahead($inDays), 'venue' => $venue, 'posted_by_id' => $postedBy,
                'status' => $status, 'capacity' => $capacity, 'description' => $description, 'created_at' => $this->ago($createdDaysAgo)]);
        }
        DB::table('event_registrations')->insert([
            ['event_id' => 1, 'user_id' => self::ANDREA, 'created_at' => $this->ago(3)],
            ['event_id' => 1, 'user_id' => self::KIM, 'created_at' => $this->ago(2)],
            ['event_id' => 2, 'user_id' => self::PAOLO, 'created_at' => $this->ago(1)],
        ]);
        foreach ([
            [2, self::LEA, 'Celebrate scholarship and service at the C.P. Garcia Event', 2, 21, 'approved'],
            [1, self::SANTOS, 'See this year’s disaster-resilience theses presented live', 1, 9, 'approved'],
            [5, self::SANTOS, 'Sit in on a thesis defense: open to all students', 0, 5, 'pending'],
        ] as [$event, $by, $headline, $startedDaysAgo, $endsInDays, $status]) {
            Ad::create(['event_id' => $event, 'created_by_id' => $by, 'headline' => $headline, 'starts_at' => $this->ago($startedDaysAgo), 'ends_at' => $this->ahead($endsInDays), 'status' => $status]);
        }
    }

    private function groups(): void
    {
        ResearchGroup::create(['id' => 1, 'adviser_id' => self::SANTOS, 'name' => 'Disaster Informatics Lab',
            'description' => 'Undergraduate researchers building early-warning and community-mapping tools with barangay partners.', 'created_at' => $this->ago(60)]);
        foreach ([[self::ANDREA, 'leader', 60], [self::KIM, 'member', 40], [self::AQUINO, 'mentor', 30]] as [$user, $role, $daysAgo]) {
            GroupMember::create(['research_group_id' => 1, 'user_id' => $user, 'role' => $role, 'added_at' => $this->ago($daysAgo)]);
        }
        GroupDeadline::create(['research_group_id' => 1, 'title' => 'Lab meeting: bring your progress slides', 'due_at' => $this->ahead(3)]);
        GroupDeadline::create(['research_group_id' => 1, 'title' => 'Chapter 3 (Methodology) draft due', 'due_at' => $this->ahead(7)]);

        ResearchGroup::create(['id' => 2, 'adviser_id' => self::AQUINO, 'name' => 'Tinig Writers Circle',
            'description' => 'Student writers preparing work for the Tinig literary folio, Vol. 7.', 'created_at' => $this->ago(45)]);
        GroupMember::create(['research_group_id' => 2, 'user_id' => self::PAOLO, 'role' => 'leader', 'added_at' => $this->ago(45)]);
        GroupDeadline::create(['research_group_id' => 2, 'title' => 'Folio manuscripts due', 'due_at' => $this->ahead(25)]);
    }

    private function portfolios(): void
    {
        foreach ([
            [self::ANDREA, 'BS Computer Science (in progress)', 'University of Iloilo', '2027'],
            [self::ANDREA, 'STEM Strand, Senior High School — With High Honors', 'Iloilo National High School', '2023'],
            [self::PAOLO, 'AB Literature (in progress)', 'University of Iloilo', '2028'],
            [self::KIM, 'BS Biology (in progress)', 'University of Iloilo', '2027'],
            [self::SANTOS, 'PhD Computer Science', 'University of the Philippines Diliman', '2016'],
            [self::SANTOS, 'MS Computer Science', 'Ateneo de Manila University', '2011'],
            [self::AQUINO, 'MFA Creative Writing', 'De La Salle University', '2009'],
        ] as [$user, $degree, $school, $year]) {
            Background::create(['user_id' => $user, 'degree' => $degree, 'school' => $school, 'year' => $year]);
        }

        foreach ([
            [self::ANDREA, 'award', 'Best Undergraduate Paper — Regional ICT Congress', 'PSITE Region VI', '2026', true],
            [self::ANDREA, 'grant', 'DOST-SEI Undergraduate Scholarship', 'DOST Science Education Institute', '2023', true],
            [self::ANDREA, 'certification', 'AWS Certified Cloud Practitioner', 'Amazon Web Services', '2026', false],
            [self::PAOLO, 'award', 'Palanca Awards — Kabataan Essay, 2nd Prize', 'Carlos Palanca Foundation', '2025', true],
            [self::KIM, 'grant', 'Student Research Grant', 'Office of Research', '2026', false],
            [self::SANTOS, 'award', 'Outstanding Research Mentor', 'University of Iloilo', '2025', true],
        ] as [$user, $kind, $title, $issuer, $year, $verified]) {
            Honor::create(['user_id' => $user, 'kind' => $kind, 'title' => $title, 'issuer' => $issuer, 'year' => $year,
                'verified' => $verified, 'verified_by_id' => $verified ? self::LEA : null, 'verified_at' => $verified ? $this->ago(30) : null]);
        }
    }

    private function notifications(): void
    {
        foreach ([
            [self::ANDREA, 'group_added', 'Dr. Maria Santos added you to the research group “Disaster Informatics Lab”.', '/groups/1', 60, true],
            [self::ANDREA, 'work_approved', '“Offline-First Flood Alert Mesh for Barangay Responders” was approved by Dr. Maria Santos. It’s now public.', '/works/1', 12, true],
            [self::ANDREA, 'work_comment', 'Kim Dela Cruz commented on your published work “Offline-First Flood Alert Mesh for Barangay Responders”.', '/works/1#discussion', 10, false],
            [self::ANDREA, 'group_deadline', 'New deadline in “Disaster Informatics Lab”: Chapter 3 (Methodology) draft due.', '/groups/1', 1, false],
            [self::PAOLO, 'work_revision', 'Prof. Ramon Aquino returned “The Weight of Salt (Essay)” with comments. Revise and resubmit.', '/works/5', 4, false],
            [self::KIM, 'work_under_review', 'Dr. Maria Santos started reviewing “Microplastic Load in Bivalves Sold at Three Iloilo Wet Markets”.', '/works/6', 0.5, false],
            [self::SANTOS, 'work_submitted', 'Andrea Villanueva submitted “Predicting First-Year Dropout Risk from LMS Activity Logs” for review.', '/works/4', 2, false],
            [self::SANTOS, 'opportunity_application', 'Kim Dela Cruz applied to “Undergraduate Research Assistants — Disaster Informatics Lab”.', '/post', 2, false],
            [self::LEA, 'educator_signup', 'Prof. Carla Javier signed up as an educator and is waiting for verification.', '/admin?tab=educators', 1, false],
            [self::LEA, 'event_proposed', 'Prof. Ramon Aquino proposed “Literature Colloquium: Writing the Regions” and it needs approval.', '/admin?tab=events', 1, false],
            [self::LEA, 'ad_requested', 'Dr. Maria Santos requested an ad slot for “Thesis Defense Week: College of Computing”.', '/admin?tab=ads', 0, false],
            [self::ANDREA, 'announcement', 'Lea Mercado posted an announcement: “Undergraduate Research Fair: poster submissions are open”', '/announcements#a-1', 2, false],
            [self::ANDREA, 'announcement', 'Dr. Maria Santos posted an announcement: “Thesis defense schedule for the College of Computing is posted”', '/announcements#a-3', 1, false],
        ] as [$user, $type, $message, $link, $daysAgo, $read]) {
            Notification::create(['user_id' => $user, 'type' => $type, 'message' => $message, 'link' => $link, 'read' => $read, 'created_at' => $this->ago($daysAgo)]);
        }
    }

    private function publications(): void
    {
        $pubs = [
            [1, self::SANTOS, 'public', 20, 34, 'Community-Based Flood Early Warning: Lessons from Five Years of Barangay Partnerships',
                'Between 2021 and 2026 the Disaster Informatics Lab co-designed flood early-warning tools with eleven riverside barangays. This paper reports what made the systems last: local ownership of sensors, alert wording tested with residents, and redundancy over sophistication. We find that alert trust, not technical accuracy, best predicted evacuation compliance.',
                ['Disaster Risk Reduction', 'Early Warning Systems', 'Community Engagement'],
                'A multi-site case study across eleven barangays in Iloilo. We combined sensor logs (2021–2026), 64 semi-structured interviews with barangay officials and residents, and household surveys after three typhoon seasons (n = 912). Interviews were coded thematically by two researchers; survey data were analysed with mixed-effects logistic regression on evacuation compliance.',
                "Introduction\n\nEarly-warning systems often fail after the project that installed them ends. We asked a simpler question than most evaluations: which systems were still trusted and used five years later?\n\nFindings\n\nThree factors separated lasting systems from abandoned ones. First, barangay responders, not the university, owned and maintained the sensors. Second, alert messages were written and tested with residents in Hiligaynon. Third, every system had a low-tech fallback: a siren, a bell, or a runner.\n\nConclusion\n\nCommunities kept the systems they understood. Researchers designing early-warning tools should budget as much time for alert wording and handover as for hardware."],
            [2, self::SANTOS, 'internal', 8, 12, 'Fairness Audits for Early-Dropout Prediction Models in Philippine State Universities',
                'Dropout prediction models are spreading across campuses, but few are checked for unequal error rates. We propose a lightweight audit protocol for registrars and test it on two anonymised cohorts, showing that a model with high overall accuracy missed at-risk students from satellite campuses twice as often.',
                ['Machine Learning', 'Fairness', 'Higher Education'],
                'Retrospective analysis of anonymised learning-management-system logs from two cohorts (2,300 and 2,140 first-year students). We compared false-negative rates across campus, program and scholarship status, with bootstrap confidence intervals.',
                'This internal report is shared with university offices only. It summarises the audit protocol and the results for the two cohorts, and recommends that any dropout model be audited each semester before it is used to allocate support.'],
            [3, self::SANTOS, 'draft', null, 2, 'Low-Power LoRa Mesh Routing for Upland Barangays (working paper)',
                'A working paper on adapting the flood alert mesh to upland terrain, where line-of-sight between barangay halls is rare and solar charging is unreliable during the rainy season.',
                ['LoRa', 'IoT', 'Mesh Networks'],
                'Planned: field tests in two upland barangays over one rainy season.', ''],
            [4, self::AQUINO, 'public', 15, 25, 'Writing the Shoreline: Hiligaynon Poetics and Coastal Memory',
                'An essay on how contemporary Hiligaynon poets write the coast as an archive of family and labour, and what this means for teaching regional literature in the university classroom.',
                ['Poetry', 'Hiligaynon', 'Regional Literature'],
                'Close reading of 42 poems published in regional folios between 2010 and 2025, with interviews of six poets.',
                "The shoreline in Hiligaynon poetry is rarely scenery. It is a ledger of who left, who stayed, and what the sea took.\n\nThis essay reads the coast as an archive, and argues that student writers should be taught to read their own places the same way."],
            [5, self::AQUINO, 'internal', 4, 6, 'Teaching Creative Non-fiction with Community Oral Histories',
                'A teaching note on a semester-long assignment in which students record and transcribe an elder’s oral history, then shape it into creative non-fiction with the elder’s consent and review.',
                ['Pedagogy', 'Creative Non-fiction', 'Oral History'],
                'Reflective teaching practice across three sections (n = 74 students), with student reflections and consent records.', ''],
        ];
        foreach ($pubs as [$id, $author, $visibility, $publishedDaysAgo, $createdDaysAgo, $title, $abstract, $keywords, $methodology, $fullText]) {
            $created = $this->ago($createdDaysAgo);
            Publication::create(['id' => $id, 'author_id' => $author, 'visibility' => $visibility, 'title' => $title, 'abstract' => $abstract,
                'keywords' => $keywords, 'methodology' => $methodology, 'full_text' => $fullText, 'created_at' => $created, 'updated_at' => $created,
                'published_at' => $publishedDaysAgo === null ? null : $this->ago($publishedDaysAgo)]);
        }
        DB::table('publication_authors')->insert(['publication_id' => 1, 'user_id' => self::ANDREA, 'order' => 1]);
    }

    private function announcements(): void
    {
        foreach ([
            [1, self::LEA, 'system', null, null, true, $this->ago(2), 'Undergraduate Research Fair: poster submissions are open',
                "The **Undergraduate Research Fair** is on its way, and every approved work on Tuklas can take part.\n\n## How to join\n- Make sure your work is **approved** on Tuklas\n- Upload your poster PDF to your work page\n- Register for the fair under _Academic events_\n\nPosters are due two weeks before the fair. Questions? Message the Office of Research & Publications."],
            [2, self::LEA, 'system', null, null, false, $this->ago(6), 'Scheduled maintenance this Saturday, 8–10 AM',
                'Tuklas will be read-only on **Saturday from 8 to 10 AM** while we update the servers. Drafts you save before then are safe.'],
            [3, self::SANTOS, 'department', 'College of Computing', null, false, $this->ago(1), 'Thesis defense schedule for the College of Computing is posted',
                "The final defense schedule is now up. Please check your slot and room:\n\n1. Rooms 301–304, Computing Building\n2. 30 minutes per group, plus 15 minutes for questions\n3. Bring three printed copies for the panel\n\nSee the _Thesis Defense Week_ event for details."],
            [4, self::SANTOS, 'group', null, 1, true, $this->hoursAgo(5), 'Lab meeting moved to Thursday, 3 PM',
                'This week’s lab meeting moves to **Thursday at 3 PM** in the Disaster Informatics Lab. Bring your progress slides and one question you’re stuck on.'],
            [5, self::AQUINO, 'group', null, 2, false, $this->hoursAgo(26), 'Workshop: revising the middle of an essay',
                'Next session we’ll workshop the middle sections of your essays. Bring a printed draft and mark the paragraph where you think the thread gets lost.'],
        ] as [$id, $author, $scope, $department, $group, $pinned, $at, $title, $body]) {
            Announcement::create(['id' => $id, 'author_id' => $author, 'scope' => $scope, 'department' => $department, 'research_group_id' => $group,
                'pinned' => $pinned, 'title' => $title, 'body' => $body, 'created_at' => $at, 'updated_at' => $at]);
        }
        DB::table('announcement_reads')->insert([
            ['announcement_id' => 1, 'user_id' => self::KIM, 'read_at' => $this->hoursAgo(30)],
            ['announcement_id' => 1, 'user_id' => self::PAOLO, 'read_at' => $this->hoursAgo(20)],
            ['announcement_id' => 2, 'user_id' => self::ANDREA, 'read_at' => $this->hoursAgo(100)],
            ['announcement_id' => 2, 'user_id' => self::KIM, 'read_at' => $this->hoursAgo(90)],
            ['announcement_id' => 4, 'user_id' => self::KIM, 'read_at' => $this->hoursAgo(3)],
        ]);
    }

    private function chat(): void
    {
        $lab = [self::SANTOS, self::ANDREA, self::KIM, self::AQUINO];

        $this->conversation(['kind' => 'direct', 'direct_key' => Conversation::directKey(self::ANDREA, self::KIM)], [self::ANDREA, self::KIM], [
            [self::KIM, 30, 'Hi Andrea! Saw your comment on the flood mesh. Want to try feeding my river sensor readings into it?'],
            [self::ANDREA, 29, 'Yes! The mesh accepts any reading over LoRa. What’s your sensor’s update interval?'],
            [self::KIM, 28.5, 'Every 5 minutes, every minute during heavy rain.'],
            [self::ANDREA, 28, 'Perfect, that fits. Let’s test at the lab on Thursday after the meeting.'],
            [self::KIM, 1.5, 'Bringing two kits on Thursday. Can you bring the gateway?'],
        ], [self::ANDREA => 2]);

        $this->conversation(['kind' => 'direct', 'direct_key' => Conversation::directKey(self::ANDREA, self::SANTOS)], [self::ANDREA, self::SANTOS], [
            [self::ANDREA, 50, 'Good afternoon, Dr. Santos. I uploaded my Chapter 3 draft to the lab’s files. Could you check the sampling section?'],
            [self::SANTOS, 47, 'Thanks, Andrea. I’ll read it tonight. Make sure you justify why you chose three barangays and not five.'],
            [self::ANDREA, 46, 'Noted, I’ll add that to 3.2. Thank you!'],
        ]);

        $this->conversation(['kind' => 'direct', 'direct_key' => Conversation::directKey(self::SANTOS, self::AQUINO)], [self::SANTOS, self::AQUINO], [
            [self::SANTOS, 72, 'Ramon, would you mentor the lab on writing for non-specialist readers? Our alert messages need a writer’s ear.'],
            [self::AQUINO, 70, 'Happy to. Add me to the group and I’ll run a session on plain-language alerts.'],
            [self::SANTOS, 69, 'Done. Thank you!'],
        ]);

        $this->conversation(['kind' => 'channel', 'research_group_id' => 1, 'name' => 'general'], $lab, [
            [self::SANTOS, 26, 'Welcome back, everyone. Lab meeting moves to Thursday this week (see the announcement).'],
            [self::ANDREA, 25, 'Got it. I’ll present the mesh latency results.'],
            [self::KIM, 24, 'I’ll bring the river sensor kits for a live demo.'],
            [self::AQUINO, 6, 'Looking forward to it. I’ll bring examples of alert messages that residents found clear.'],
        ], [self::ANDREA => 7]);

        [$methods, $ids] = $this->conversation(['kind' => 'channel', 'research_group_id' => 1, 'name' => 'chapter-3-methods'], $lab, [
            [self::ANDREA, 52, 'Chapter 3 outline is in the files. Comments welcome before Friday.'],
            [self::KIM, 20, 'Question: do we report the sensor calibration in Methods or in an appendix?'],
        ]);
        foreach ([
            [self::SANTOS, 19, 'Summarise it in Methods (one paragraph) and put the full calibration table in an appendix.'],
            [self::ANDREA, 18.5, 'I’ll do the same for the gateway settings.'],
        ] as [$sender, $hours, $text]) {
            Message::create(['conversation_id' => $methods->id, 'parent_id' => end($ids), 'sender_id' => $sender, 'text' => $text, 'created_at' => $this->hoursAgo($hours)]);
        }

        foreach ([
            [1, self::SANTOS, 'channel_created', 'Dr. Maria Santos opened #chapter-3-methods.', $this->ago(3)],
            [1, self::SANTOS, 'deadline_added', 'Dr. Maria Santos added the deadline “Chapter 3 (Methodology) draft due”.', $this->ago(1)],
            [1, self::SANTOS, 'announcement_posted', 'Dr. Maria Santos posted “Lab meeting moved to Thursday, 3 PM”.', $this->hoursAgo(5)],
            [2, self::AQUINO, 'group_created', 'Prof. Ramon Aquino started the group.', $this->ago(45)],
            [2, self::AQUINO, 'member_added', 'Prof. Ramon Aquino added Paolo Reyes as group leader.', $this->ago(45)],
        ] as [$group, $actor, $action, $detail, $at]) {
            GroupActivity::create(['research_group_id' => $group, 'actor_id' => $actor, 'action' => $action, 'detail' => $detail, 'created_at' => $at]);
        }

        $this->conversation(['kind' => 'channel', 'research_group_id' => 2, 'name' => 'general'], [self::AQUINO, self::PAOLO], [
            [self::AQUINO, 40, 'Folio manuscripts are due in three weeks. Post questions here.'],
            [self::PAOLO, 38, 'Sir, can essays go over 3,000 words if the folio editor agrees?'],
            [self::AQUINO, 37, 'Yes, up to 4,000 with the editor’s approval.'],
        ]);
    }

    /**
     * A conversation with its members and messages. Everyone has read everything unless $readUpTo
     * says how many hours back they stopped.
     *
     * @param  array<string, mixed>  $attributes
     * @param  list<int>  $memberIds
     * @param  list<array{int, float, string}>  $lines  [sender, hours ago, text]
     * @param  array<int, float>  $readUpTo
     * @return array{Conversation, list<int>}
     */
    private function conversation(array $attributes, array $memberIds, array $lines, array $readUpTo = []): array
    {
        $hours = array_column($lines, 1);
        $conversation = Conversation::create([...$attributes,
            'last_message_at' => $this->hoursAgo(min($hours)),
            'created_at' => $this->hoursAgo(max($hours) + 1),
        ]);
        foreach (array_unique($memberIds) as $userId) {
            ConversationMember::create(['conversation_id' => $conversation->id, 'user_id' => $userId,
                'last_read_at' => isset($readUpTo[$userId]) ? $this->hoursAgo($readUpTo[$userId]) : $this->now]);
        }
        $ids = [];
        foreach ($lines as [$sender, $hoursAgo, $text]) {
            $ids[] = Message::create(['conversation_id' => $conversation->id, 'sender_id' => $sender, 'text' => $text, 'created_at' => $this->hoursAgo($hoursAgo)])->id;
        }

        return [$conversation, $ids];
    }
}
