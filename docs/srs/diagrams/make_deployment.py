"""Writes docs/srs/diagrams/deployment.drawio (Figure 1, a UML deployment diagram) to the path in argv[1]."""
import sys
from xml.sax.saxutils import escape

out = sys.argv[1]
cells = []
n = [1]


def nid():
    n[0] += 1
    return f"c{n[0]}"


FONT = "fontFamily=Arial;fontSize=12;fontColor=#000000;strokeColor=#000000;"
NODE = "shape=cube;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;darkOpacity=0.05;darkOpacity2=0.1;size=12;verticalAlign=top;align=left;spacingLeft=10;spacingTop=6;fillColor=#ffffff;" + FONT
EXT = "shape=cube;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;darkOpacity=0.05;darkOpacity2=0.1;size=10;align=center;verticalAlign=middle;fillColor=#f2f2f2;" + FONT
COMP = "shape=module;jettyWidth=10;jettyHeight=5;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;spacingLeft=12;fillColor=#ffffff;" + FONT
ART = "shape=note;size=12;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;fillColor=#ffffff;" + FONT
ACTOR = "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=#ffffff;" + FONT
NOTE = "shape=note;size=14;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingTop=4;fillColor=#ffffff;" + FONT.replace("fontSize=12", "fontSize=11")
EDGE = "endArrow=open;endSize=10;html=1;rounded=0;labelBackgroundColor=#ffffff;fontFamily=Arial;fontSize=11;fontColor=#000000;strokeColor=#000000;"
LINE = "endArrow=none;html=1;rounded=0;strokeColor=#000000;"


def box(label, x, y, w, h, style):
    i = nid()
    cells.append(f'<mxCell id="{i}" value="{escape(label, {chr(34): "&quot;"})}" style="{style}" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
    return i


def edge(a, b, label="", style=EDGE, points=(), extra=""):
    i = nid()
    pts = "".join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in points)
    geo = f'<mxGeometry relative="1" as="geometry">' + (f'<Array as="points">{pts}</Array>' if pts else "") + "</mxGeometry>"
    cells.append(f'<mxCell id="{i}" value="{escape(label, {chr(34): "&quot;"})}" style="{style}{extra}" edge="1" parent="1" source="{a}" target="{b}">{geo}</mxCell>')
    return i


def s(stereo, name, detail=""):
    text = f"«{stereo}»<br><b>{name}</b>"
    return text + (f"<br>{detail}" if detail else "")


# Users and their device
actors = [box("Visitor", 50, 230, 30, 55, ACTOR), box("Student", 50, 335, 30, 55, ACTOR),
          box("Educator", 50, 440, 30, 55, ACTOR), box("Admin,<br>Super-admin", 50, 545, 30, 55, ACTOR)]
device = box("«device»<br><b>User's computer or phone</b>", 150, 220, 260, 400, NODE)
browser = box(s("component", "Web browser", "Chrome, Edge, Firefox, Safari"), 172, 285, 216, 70, COMP)
webapp = box("«artifact»<br><b>Tuklas web application</b><br>React 19, installable (PWA)", 182, 375, 196, 70, ART)
totp = box(s("component", "Authenticator app", "one-time codes; no connection to Tuklas"), 172, 520, 216, 75, COMP)
for a in actors:
    edge(a, device, style=LINE)

# The server
server = box("«device»<br><b>Tuklas server</b> (Ubuntu 24.04 LTS)", 480, 170, 710, 520, NODE)
nginx = box(s("component", "Web server", "Nginx, HTTPS"), 510, 240, 190, 80, COMP)
reverb = box(s("component", "Real-time server", "Laravel Reverb"), 510, 440, 190, 80, COMP)
laravel = box(s("component", "Application server", "Laravel 13 on PHP 8.4"), 740, 240, 190, 80, COMP)
mysql = box(s("database", "MySQL 8.4"), 740, 440, 190, 80, COMP)
backup = box("«artifact»<br><b>backup.sh</b><br>nightly, encrypted", 750, 590, 170, 70, ART)
queue = box(s("component", "Queue worker,<br>scheduler", "Supervisor, cron"), 970, 240, 190, 80, COMP)
files = box(s("storage", "Private file storage", "PDFs, photos, uploads"), 970, 440, 190, 80, COMP)

# Outside services
le = box("«external»<br><b>Let's Encrypt</b><br>certificate authority", 400, -40, 175, 75, EXT)
search = box("«external»<br><b>Search engines</b><br>Google Scholar", 600, -40, 175, 75, EXT)
pwned = box("«external»<br><b>Have I Been Pwned</b><br>breached passwords", 1340, 175, 220, 70, EXT)
mail = box("«external»<br><b>Email provider</b><br>SMTP relay", 1340, 265, 220, 70, EXT)
push = box("«external»<br><b>Browser push services</b><br>Google, Apple, Mozilla", 1340, 360, 220, 70, EXT)
store = box("«external»<br><b>Off-server backup storage</b><br>rclone remote", 1340, 590, 220, 70, EXT)

edge(webapp, nginx, "HTTPS: JSON API<br>WSS: live updates", extra="exitX=1;exitY=0.5;entryX=0;entryY=0.5;")
edge(le, nginx, "ACME: certificate", extra="exitX=0.5;exitY=1;entryX=0.25;entryY=0;")
edge(search, nginx, "HTTPS: public pages", extra="exitX=0.5;exitY=1;entryX=0.75;entryY=0;")
edge(nginx, laravel, "FastCGI")
edge(nginx, reverb, "WebSocket proxy")
edge(laravel, reverb, "broadcast", extra="exitX=0.25;exitY=1;entryX=0.75;entryY=0;")
edge(laravel, mysql, "SQL")
edge(laravel, queue, "jobs")
edge(laravel, files, "read, write", extra="exitX=0.75;exitY=1;entryX=0.25;entryY=0;")
edge(laravel, pwned, "HTTPS: hash prefix only", points=[(835, 210)], extra="exitX=0.5;exitY=0;entryX=0;entryY=0.5;edgeStyle=orthogonalEdgeStyle;")
edge(queue, mail, "SMTP, STARTTLS", extra="exitX=1;exitY=0.5;entryX=0;entryY=0.5;edgeStyle=orthogonalEdgeStyle;")
edge(queue, push, "HTTPS: Web Push", points=[(1100, 395)], extra="exitX=0.68;exitY=1;entryX=0;entryY=0.5;edgeStyle=orthogonalEdgeStyle;")
edge(push, device, "push messages", points=[(1600, 395), (1600, 730), (280, 730)], extra="exitX=1;exitY=0.5;entryX=0.5;entryY=1;edgeStyle=orthogonalEdgeStyle;dashed=1;")
edge(backup, mysql, "database dump", extra="exitX=0.5;exitY=0;entryX=0.5;entryY=1;")
edge(backup, files, "uploads", extra="exitX=1;exitY=0.3;entryX=0.5;entryY=1;edgeStyle=orthogonalEdgeStyle;")
edge(backup, store, "HTTPS: encrypted copy", extra="exitX=1;exitY=0.7;entryX=0;entryY=0.7;edgeStyle=orthogonalEdgeStyle;")

box("<b>Notation:</b> UML 2.5 deployment diagram. 3-D boxes are nodes (devices and outside systems); "
    "boxes with two tabs are software components; boxes with a folded corner are artifacts (deployed files); "
    "stick figures are actors. Lines are communication paths, labelled with the protocol used; "
    "the arrow points away from the side that starts the connection.", 40, 760, 640, 62, NOTE)

xml = ('<mxfile host="drawio"><diagram id="figure-1" name="Figure 1"><mxGraphModel dx="1500" dy="900" grid="1" gridSize="10" '
       'page="0" background="#ffffff"><root><mxCell id="0"/><mxCell id="1" parent="0"/>' + "".join(cells) + "</root></mxGraphModel></diagram></mxfile>")
open(out, "w", encoding="utf-8").write(xml)
print("wrote", out)
