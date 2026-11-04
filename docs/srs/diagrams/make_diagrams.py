"""Writes the SRS Appendix B diagrams (Figures 3 to 7) as .drawio files into the folder given as argv[1].

The .drawio files are the sources: edit them in draw.io, or change this script and run it again with
    python make_diagrams.py docs/srs/diagrams
then export each one to .png (see docs/srs/build.py)."""
import sys
from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(sys.argv[1])
FONT = "fontFamily=Arial;fontColor=#000000;strokeColor=#000000;"


class Diagram:
    def __init__(self, name):
        self.name, self.cells, self.n = name, [], 1

    def _id(self):
        self.n += 1
        return f"c{self.n}"

    def box(self, label, x, y, w, h, style):
        i = self._id()
        self.cells.append(f'<mxCell id="{i}" value="{escape(label, {chr(34): "&quot;"})}" style="{style}" vertex="1" parent="1">'
                          f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        return i

    def edge(self, a, b, label="", style="", points=(), pos=None):
        i = self._id()
        pts = "".join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in points)
        x = f' x="{pos}"' if pos is not None else ""
        geo = f'<mxGeometry{x} relative="1" as="geometry">' + (f'<Array as="points">{pts}</Array>' if pts else "") + "</mxGeometry>"
        self.cells.append(f'<mxCell id="{i}" value="{escape(label, {chr(34): "&quot;"})}" style="{style}" edge="1" parent="1" source="{a}" target="{b}">{geo}</mxCell>')
        return i

    def save(self):
        xml = (f'<mxfile host="drawio"><diagram id="{self.name}" name="{self.name}"><mxGraphModel grid="1" gridSize="10" page="0" background="#ffffff">'
               '<root><mxCell id="0"/><mxCell id="1" parent="0"/>' + "".join(self.cells) + "</root></mxGraphModel></diagram></mxfile>")
        (OUT / f"{self.name}.drawio").write_text(xml, encoding="utf-8")
        print("wrote", self.name)


NOTE = "shape=note;size=14;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingTop=4;fillColor=#ffffff;fontSize=11;" + FONT

# ---------------------------------------------------------------- Context diagram (DFD level 0, Gane & Sarson)
d = Diagram("context")
ENT = "rounded=0;whiteSpace=wrap;html=1;fillColor=#eeeeee;fontSize=17;fontStyle=1;" + FONT
PROC = "rounded=1;arcSize=6;whiteSpace=wrap;html=1;fillColor=#ffffff;fontSize=18;strokeWidth=2;verticalAlign=middle;" + FONT
FLOW = "endArrow=block;endFill=1;html=1;rounded=0;labelBackgroundColor=#ffffff;fontSize=15;fontFamily=Arial;fontColor=#000000;strokeColor=#000000;"
LEFT_X, ENT_W, GAP, PROC_W = 0, 180, 300, 210
PX = LEFT_X + ENT_W + GAP
RX = PX + PROC_W + GAP
# Each entity: (name, flows), a flow being (into Tuklas?, label); flows are 90 apart, entities 40 apart
left = [
    ("Visitor", [(True, "sign-up details,<br>searches"), (False, "public portfolios,<br>works, publications")]),
    ("Student", [(True, "works, revisions, comments,<br>deliverables, messages"), (False, "decisions, feedback,<br>feed, notifications")]),
    ("Educator", [(True, "reviews, publications, groups,<br>events, opportunities, announcements"), (False, "submissions, deliverables,<br>applications, notifications")]),
    ("Admin and<br>Super-admin", [(True, "verifications, approvals, report<br>decisions, roles, schools"), (False, "approval queues,<br>reports, statistics")]),
]
right = [
    ("Email provider", [(False, "emails: confirmation, reset,<br>notifications, digest")]),
    ("Browser push<br>services", [(False, "encrypted push<br>notifications")]),
    ("Breached-<br>password service", [(False, "first 5 characters<br>of a password hash"), (True, "matching hash<br>suffixes")]),
    ("Search engines", [(True, "requests for<br>public pages"), (False, "public pages with<br>citation tags, sitemap")]),
    ("Off-server<br>backup storage", [(False, "encrypted nightly<br>backups")]),
]
STEP, PAD = 90, 45


def place(entities):
    y, out = 20, []
    for name, flows in entities:
        h = PAD * 2 + STEP * (len(flows) - 1)
        out.append((name, flows, y, h))
        y += h + 40
    return out, y


L, lh = place(left)
R, rh = place(right)
H = max(lh, rh)
core = d.box("<b>0</b><hr size=\"1\"><b>Tuklas</b><br><br>research and<br>academic<br>engagement<br>hub", PX, 0, PROC_W, H, PROC)
for side, items in (("left", L), ("right", R)):
    for name, flows, y, h in items:
        x = LEFT_X if side == "left" else RX
        e = d.box(name, x, y, ENT_W, h, ENT)
        for k, (into, label) in enumerate(flows):
            fy = y + PAD + k * STEP
            ey, cy = (fy - y) / h, fy / H
            if side == "left":
                ends = f"exitX=1;exitY={ey:.4f};entryX=0;entryY={cy:.4f};" if into else f"exitX=0;exitY={cy:.4f};entryX=1;entryY={ey:.4f};"
            else:
                ends = f"exitX=0;exitY={ey:.4f};entryX=1;entryY={cy:.4f};" if into else f"exitX=1;exitY={cy:.4f};entryX=0;entryY={ey:.4f};"
            d.edge(e, core, label, FLOW + ends) if into else d.edge(core, e, label, FLOW + ends)
d.box("<b>Notation:</b> data flow diagram, level 0 (Gane and Sarson). The rounded box is the whole system as one process, "
      "numbered 0; shaded rectangles are external entities; arrows are data flows, labelled with the data they carry.",
      0, H + 30, RX + ENT_W, 52, NOTE.replace("fontSize=11", "fontSize=14"))
d.save()

# ---------------------------------------------------------------- Entity-relationship diagrams (crow's foot)
TABLE = "rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingTop=2;fillColor=#ffffff;fontSize=12;" + FONT
GROUP = "rounded=1;arcSize=2;whiteSpace=wrap;html=1;verticalAlign=top;align=left;spacingLeft=10;spacingTop=4;fillColor=#f7f7f7;strokeColor=#888888;dashed=1;fontSize=13;fontStyle=1;fontFamily=Arial;fontColor=#333333;"
ONE_MANY = "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=ERmany;startArrow=ERmandOne;endFill=0;startFill=0;endSize=10;startSize=10;strokeColor=#000000;"
ONE_ONE = "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=ERmandOne;startArrow=ERmandOne;endFill=0;startFill=0;endSize=10;startSize=10;strokeColor=#000000;"
W, ROW, HEAD = 260, 18, 26


def table(d, name, rows, x, y):
    label = f"<b>{name}</b><hr size=\"1\">" + "<br>".join(rows)
    h = HEAD + ROW * len(rows) + 10
    return d.box(label, x, y, W, h, TABLE), h


def column(d, x, y, tables):
    ids = {}
    for name, rows in tables:
        i, h = table(d, name, rows, x, y)
        ids[name] = i
        y += h + 30
    return ids, y


def height(groups):
    """The group boxes' height: the tallest column, plus its title and margins."""
    return max(60 + sum(HEAD + ROW * len(rows) + 10 + 30 for _, rows in tables) for tables in groups) + 10


def fit_groups(d, bottom):
    """Makes the dashed group boxes (drawn first, so they sit behind the tables) reach below the last table."""
    d.cells = [c.replace('height="760"', f'height="{bottom - 30}"') if "dashed=1" in c else c for c in d.cells]


ERD_NOTE = ("<b>Notation:</b> crow's foot. A bar is \"exactly one\", a crow's foot \"many\". PK is the primary key, FK a foreign key. "
            "Foreign keys to users are listed in each table, not drawn, to keep the diagram readable. Laravel's own tables "
            "(sessions, cache, jobs) are left out.")

d = Diagram("erd-people-works")
d.box("People and schools", 20, 20, 300, 760, GROUP)
d.box("Works", 340, 20, 300, 760, GROUP)
d.box("Reviews, engagement and publications", 660, 20, 300, 760, GROUP)
a, ya = column(d, 40, 60, [
    ("institutions", ["PK id", "name, short_name, email_domains"]),
    ("departments", ["PK id", "FK institution_id", "name"]),
    ("users", ["PK id", "FK institution_id", "role, email, name, username", "verified, is_super_admin"]),
    ("profiles", ["PK id", "FK user_id", "FK department_id", "titles, bio"]),
    ("follows", ["PK id", "FK user_id → users", "kind (person, department, tag), target"]),
    ("notifications", ["PK id", "FK user_id → users", "kind, message, link, read_at"]),
])
b, yb = column(d, 360, 60, [
    ("works", ["PK id", "FK author_id → users", "FK adviser_id → users", "FK approved_by_id → users", "FK institution_id", "type, title, status, visibility"]),
    ("work_authors", ["FK work_id", "FK user_id → users"]),
    ("work_versions", ["PK id", "FK work_id", "version, title, abstract"]),
    ("defense_stages", ["PK id", "FK work_id", "kind, date, panel, verdict"]),
    ("saved_works", ["FK work_id", "FK user_id → users"]),
])
c, yc = column(d, 680, 60, [
    ("reviews", ["PK id", "FK work_id", "FK reviewer_id → users", "decision, comment (encrypted)"]),
    ("revision_items", ["PK id", "FK review_id", "text (encrypted), done, confirmed"]),
    ("comments", ["PK id", "FK work_id", "FK author_id → users", "scope, text (encrypted)"]),
    ("reactions", ["PK id", "FK work_id", "FK user_id → users", "kind"]),
    ("publications", ["PK id", "FK author_id → users", "FK institution_id", "title, visibility"]),
    ("publication_authors", ["FK publication_id", "FK user_id → users"]),
])
d.edge(a["institutions"], a["departments"], style=ONE_MANY + "exitX=0;exitY=0.5;entryX=0;entryY=0.5;", points=[(30, 100), (30, 180)])
d.edge(a["institutions"], a["users"], style=ONE_MANY + "exitX=1;exitY=0.5;entryX=1;entryY=0.3;", points=[(310, 100), (310, 270)])
d.edge(a["users"], a["profiles"], style=ONE_ONE + "exitX=0.5;exitY=1;entryX=0.5;entryY=0;")
d.edge(a["departments"], a["profiles"], style=ONE_MANY + "exitX=0;exitY=0.8;entryX=0;entryY=0.5;", points=[(25, 200), (25, 400)])
for t in ("work_authors", "work_versions", "defense_stages", "saved_works"):
    d.edge(b["works"], b[t], style=ONE_MANY + "exitX=0;exitY=0.9;entryX=0;entryY=0.5;", points=[(350, 0)] if False else ())
for t in ("reviews", "comments", "reactions"):
    d.edge(b["works"], c[t], style=ONE_MANY + "exitX=1;exitY=0.5;entryX=0;entryY=0.5;")
d.edge(c["reviews"], c["revision_items"], style=ONE_MANY + "exitX=0.5;exitY=1;entryX=0.5;entryY=0;")
d.edge(c["publications"], c["publication_authors"], style=ONE_MANY + "exitX=0.5;exitY=1;entryX=0.5;entryY=0;")
fit_groups(d, max(ya, yb, yc))
d.box(ERD_NOTE, 20, max(ya, yb, yc) + 10, 940, 48, NOTE)
d.save()

d = Diagram("erd-groups-events")
d.box("Research groups and deliverables", 20, 20, 300, 760, GROUP)
d.box("Chat and announcements", 340, 20, 300, 760, GROUP)
d.box("Events, opportunities and moderation", 660, 20, 300, 760, GROUP)
a, ya = column(d, 40, 60, [
    ("research_groups", ["PK id", "FK adviser_id → users", "name, description"]),
    ("group_members", ["FK research_group_id", "FK user_id → users", "role (leader, member, mentor)"]),
    ("group_deadlines", ["PK id", "FK research_group_id", "title, due_at, submission_mode"]),
    ("deliverable_submissions", ["PK id", "FK group_deadline_id", "FK reviewed_by_id → users", "status"]),
    ("deliverable_versions", ["PK id", "FK deliverable_submission_id", "FK student_id → users", "file, note, feedback (encrypted)"]),
])
b, yb = column(d, 360, 60, [
    ("conversations", ["PK id", "FK research_group_id (channels)", "kind (direct, channel), name"]),
    ("conversation_members", ["FK conversation_id", "FK user_id → users", "last read"]),
    ("messages", ["PK id", "FK conversation_id", "FK sender_id → users", "FK parent_id (threads)", "text (encrypted), file"]),
    ("announcements", ["PK id", "FK author_id → users", "FK institution_id, department_id", "FK research_group_id", "scope, title, body, pinned"]),
    ("announcement_reads", ["FK announcement_id", "FK user_id → users"]),
])
c, yc = column(d, 680, 60, [
    ("events", ["PK id", "FK posted_by_id → users", "FK institution_id", "category, starts_at, seats, status"]),
    ("event_registrations", ["FK event_id", "FK user_id → users"]),
    ("ads", ["PK id", "FK event_id", "headline, shows_from, until, status"]),
    ("opportunities", ["PK id", "FK adviser_id → users", "kind, deadline, slots, audience"]),
    ("opportunity_applications", ["PK id", "FK opportunity_id", "FK user_id → users", "message"]),
    ("reports", ["PK id", "FK reporter_id → users", "target type and id", "reason, status"]),
])
d.edge(a["research_groups"], a["group_members"], style=ONE_MANY + "exitX=0.5;exitY=1;entryX=0.5;entryY=0;")
d.edge(a["research_groups"], a["group_deadlines"], style=ONE_MANY + "exitX=0;exitY=0.5;entryX=0;entryY=0.5;", points=[(30, 100), (30, 300)])
d.edge(a["group_deadlines"], a["deliverable_submissions"], style=ONE_MANY + "exitX=0.5;exitY=1;entryX=0.5;entryY=0;")
d.edge(a["deliverable_submissions"], a["deliverable_versions"], style=ONE_MANY + "exitX=0.5;exitY=1;entryX=0.5;entryY=0;")
d.edge(a["research_groups"], b["conversations"], style=ONE_MANY + "exitX=1;exitY=0.4;entryX=0;entryY=0.4;")
d.edge(b["conversations"], b["conversation_members"], style=ONE_MANY + "exitX=0.5;exitY=1;entryX=0.5;entryY=0;")
d.edge(b["conversations"], b["messages"], style=ONE_MANY + "exitX=1;exitY=0.5;entryX=1;entryY=0.3;", points=[(630, 100), (630, 330)])
d.edge(b["announcements"], b["announcement_reads"], style=ONE_MANY + "exitX=0.5;exitY=1;entryX=0.5;entryY=0;")
d.edge(c["events"], c["event_registrations"], style=ONE_MANY + "exitX=0.5;exitY=1;entryX=0.5;entryY=0;")
d.edge(c["events"], c["ads"], style=ONE_MANY + "exitX=1;exitY=0.5;entryX=1;entryY=0.5;", points=[(950, 110), (950, 280)])
d.edge(c["opportunities"], c["opportunity_applications"], style=ONE_MANY + "exitX=0.5;exitY=1;entryX=0.5;entryY=0;")
fit_groups(d, max(ya, yb, yc))
d.box(ERD_NOTE, 20, max(ya, yb, yc) + 10, 940, 48, NOTE)
d.save()

# ---------------------------------------------------------------- Use case diagram (UML)
d = Diagram("use-cases")
ACTOR = "shape=umlActor;verticalLabelPosition=top;verticalAlign=bottom;html=1;outlineConnect=0;fillColor=#ffffff;fontSize=16;fontStyle=1;" + FONT
UC = "ellipse;whiteSpace=wrap;html=1;fillColor=#ffffff;fontSize=14;spacing=8;" + FONT
BUS = "edgeStyle=orthogonalEdgeStyle;endArrow=none;html=1;rounded=0;strokeColor=#000000;"
GEN = "endArrow=block;endFill=0;endSize=16;html=1;rounded=0;strokeColor=#000000;"
columns = [
    ("Visitor", ["Read public research", "Cite and share a work", "Sign up"]),
    ("Student", ["Manage portfolio", "Submit and revise a work", "Record defense stages", "Comment, react, save, follow",
                 "Hand in a deliverable", "Chat", "Register for an event", "Apply to an opportunity", "Report content"]),
    ("Educator", ["Review and decide on a work", "Publish own research", "Run a research group", "Review a deliverable",
                  "Propose an event and its ad", "Post an opportunity", "Post an announcement"]),
    ("Admin", ["Verify educators and their rights", "Confirm sign-ups, manage departments", "Approve research, events, ads, honors",
               "Handle reports, moderate", "Manage users and roles"]),
    ("Super-admin", ["Manage schools and email domains", "Make a super-admin"]),
]
COL_W, UC_W, UC_H, ROW_H, TOP = 250, 218, 62, 80, 210
rows = max(len(cases) for _, cases in columns)
d.box("Tuklas", 10, TOP - 40, COL_W * len(columns) + 40, rows * ROW_H + 70,
      "rounded=0;whiteSpace=wrap;html=1;verticalAlign=top;fillColor=none;fontSize=18;fontStyle=1;" + FONT)
actors = []
for k, (name, cases) in enumerate(columns):
    x = 30 + k * COL_W
    actor = d.box(name, x + 10, 45, 40, 76, ACTOR)
    actors.append(actor)
    bus_x = x + 30
    for r, case in enumerate(cases):
        y = TOP + 10 + r * ROW_H
        uc = d.box(case, x + 32, y, UC_W, UC_H, UC)
        d.edge(actor, uc, style=BUS + "exitX=0.5;exitY=1;entryX=0;entryY=0.5;", points=[(bus_x, y + UC_H / 2)])
for child, parent in ((1, 0), (2, 1), (4, 3)):
    d.edge(actors[child], actors[parent], style=GEN + "exitX=0;exitY=0.35;entryX=1;entryY=0.35;")
d.box("<b>Notation:</b> UML 2.5 use case diagram. Stick figures are actors (user classes); ellipses inside the box are use cases of Tuklas; "
      "a line links an actor to the use cases it starts. A hollow arrow is generalization: a Student can also do what a Visitor does, "
      "an Educator what a Student does, and a Super-admin what an Admin does. Every member also signs in and manages their account (Section 4.1).",
      10, TOP + rows * ROW_H + 50, COL_W * len(columns) + 40, 70, NOTE.replace("fontSize=11", "fontSize=14"))
d.save()

# ---------------------------------------------------------------- State diagram (UML) of a work
d = Diagram("work-states")
STATE = "rounded=1;arcSize=30;whiteSpace=wrap;html=1;fillColor=#ffffff;fontSize=16;fontStyle=1;" + FONT
COMPOSITE = "rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#f7f7f7;fontSize=15;fontStyle=1;verticalAlign=top;align=left;spacingLeft=12;spacingTop=6;" + FONT
INIT = "ellipse;html=1;fillColor=#000000;strokeColor=#000000;aspect=fixed;"
FINAL = "ellipse;html=1;shape=doubleEllipse;fillColor=#000000;strokeColor=#000000;aspect=fixed;"
TRANS = "endArrow=open;endSize=12;html=1;rounded=0;labelBackgroundColor=#ffffff;fontSize=14;fontFamily=Arial;fontColor=#000000;strokeColor=#000000;"
ORTH = TRANS + "edgeStyle=orthogonalEdgeStyle;"
start = d.box("", 20, 247, 26, 26, INIT)
draft = d.box("Draft", 110, 225, 150, 70, STATE)
adviser = d.box("With the adviser", 380, 150, 470, 220, COMPOSITE)
submitted = d.box("Submitted", 410, 225, 150, 70, STATE)
review = d.box("Under review", 670, 225, 150, 70, STATE)
approved = d.box("Approved<br><span style=\"font-weight:normal;font-size:13px\">public to its readers</span>", 1000, 120, 180, 70, STATE)
rejected = d.box("Rejected", 1000, 330, 180, 70, STATE)
revision = d.box("Needs revision", 520, 500, 190, 70, STATE)
end_del = d.box("", 172, 90, 26, 26, FINAL)
end_ok = d.box("", 1260, 142, 26, 26, FINAL)
end_no = d.box("", 1260, 352, 26, 26, FINAL)
d.edge(start, draft, "", TRANS)
d.edge(draft, submitted, "Submit for<br>adviser review", TRANS)
d.edge(draft, end_del, "Delete draft", TRANS + "exitX=0.5;exitY=0;")
d.edge(submitted, review, "Start review", TRANS)
d.edge(adviser, approved, "Approve &amp; sign off<br>[every fix confirmed]", TRANS + "exitX=1;exitY=0.2;entryX=0;entryY=0.5;")
d.edge(adviser, rejected, "Reject<br>[confirmed]", TRANS + "exitX=1;exitY=0.85;entryX=0;entryY=0.5;")
d.edge(adviser, revision, "Return with<br>comments", ORTH + "exitX=0.6;exitY=1;entryX=0.75;entryY=0;")
d.edge(revision, submitted, "Revise &amp;<br>resubmit", ORTH + "exitX=0;exitY=0.5;entryX=0.5;entryY=1;", points=[(485, 535)])
d.edge(approved, end_ok, "", TRANS)
d.edge(rejected, end_no, "", TRANS)
d.box("<b>Notation:</b> UML 2.5 state machine diagram. Rounded boxes are the statuses of a work. \"With the adviser\" is a composite "
      "state: a transition from its edge applies to both of its states. Arrows are transitions, labelled with the action that causes "
      "them and [the condition it needs]. The filled circle is the start; ringed circles are ends. An approved work can still be "
      "removed by an Admin (REQ-MOD-4).", 20, 610, 1270, 70, NOTE.replace("fontSize=11", "fontSize=14"))
d.save()
