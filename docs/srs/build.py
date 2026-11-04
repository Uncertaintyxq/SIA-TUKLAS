"""Builds docs/Tuklas SRS.docx: the course template (docs/SRS Template.docx) filled in with the text
of each section in docs/srs/*.md. Sections that aren't written yet keep the template's prompts.

    python docs/srs/build.py        (from the repo root; needs python-docx)

Each .md file holds one template section. A "## <heading>" line names the template heading whose
prompt it replaces, spelled as in the template. Under it: paragraphs, "- " bullets, "| tables |",
**bold**, *italic*, and figures as "![Figure 1. Caption](diagrams/name.png)" (the diagrams are
drawn in Mermaid; diagrams/render.cjs turns them into the .png files). The template's styles, numbering and table of contents are kept; Word
refreshes the page numbers in the table of contents when the file is opened.
"""

import re
import sys
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches
from PIL import Image

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE.parent / "SRS Template.docx"
OUTPUT = HERE.parent / "Tuklas SRS.docx"

BODY_FONT = "Times"
BULLET_NUM_ID = "90"
TEXT_WIDTH = 9360  # 6.5 inches in twentieths of a point: the page less its 1-inch margins


def sections() -> dict[str, list[str]]:
    """'heading' => its lines, from every .md file in this folder, in file order."""
    found: dict[str, list[str]] = {}
    for md in sorted(HERE.glob("*.md")):
        current = None
        for line in md.read_text(encoding="utf-8").splitlines():
            if line.startswith("## "):
                current = line[3:].strip()
                found[current] = []
            elif current is not None:
                found[current].append(line)
    return found


def blocks(lines: list[str]) -> list[tuple[str, list[str]]]:
    """Groups lines into ('p', [text]), ('ul', [items]) and ('table', [rows]) blocks. Paragraph
    lines next to each other belong to one paragraph; a blank line starts a new one."""
    merged: list[tuple[str, list[str]]] = []
    previous_blank = True
    for line in lines + [""]:
        if not line.strip():
            previous_blank = True
            continue
        if line.startswith("!["):
            merged.append(("img", [line]))
            previous_blank = True
            continue
        kind = "ul" if line.startswith("- ") else "table" if line.startswith("|") else "p"
        if kind == "p" and merged and merged[-1][0] == "p" and not previous_blank:
            merged[-1][1][0] += " " + line.strip()
        elif kind != "p" and merged and merged[-1][0] == kind:
            merged[-1][1].append(line[2:] if kind == "ul" else line.strip())
        else:
            merged.append((kind, [line[2:] if kind == "ul" else line.strip()]))
        previous_blank = False
    return merged


def run_props(bold=False, italic=False, size=22, font=BODY_FONT):
    rpr = OxmlElement("w:rPr")
    fonts = OxmlElement("w:rFonts")
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        fonts.set(qn(attr), font)
    rpr.append(fonts)
    for tag, on in (("w:b", bold), ("w:i", italic)):
        el = OxmlElement(tag)
        el.set(qn("w:val"), "1" if on else "0")
        rpr.append(el)
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "000000")
    rpr.append(color)
    for tag in ("w:sz", "w:szCs"):
        el = OxmlElement(tag)
        el.set(qn("w:val"), str(size))
        rpr.append(el)
    return rpr


def add_runs(paragraph, text: str, size=22, bold=False):
    """Appends text with **bold** and *italic* spans as runs."""
    for part in re.split(r"(\*\*[^*]+\*\*|\*[^*]+\*)", text):
        if not part:
            continue
        is_bold = part.startswith("**")
        is_italic = not is_bold and part.startswith("*")
        content = part.strip("*") if (is_bold or is_italic) else part
        run = OxmlElement("w:r")
        run.append(run_props(bold=bold or is_bold, italic=is_italic, size=size))
        t = OxmlElement("w:t")
        t.set(qn("xml:space"), "preserve")
        t.text = content
        run.append(t)
        paragraph.append(run)


def paragraph(text: str, *, bullet=False, after=120, align="both", size=22, bold=False):
    p = OxmlElement("w:p")
    ppr = OxmlElement("w:pPr")
    if bullet:
        num = OxmlElement("w:numPr")
        ilvl = OxmlElement("w:ilvl")
        ilvl.set(qn("w:val"), "0")
        num_id = OxmlElement("w:numId")
        num_id.set(qn("w:val"), BULLET_NUM_ID)
        num.append(ilvl)
        num.append(num_id)
        ppr.append(num)
    spacing = OxmlElement("w:spacing")
    spacing.set(qn("w:before"), "0")
    spacing.set(qn("w:after"), str(after))
    spacing.set(qn("w:line"), "240")
    spacing.set(qn("w:lineRule"), "auto")
    ppr.append(spacing)
    if not bullet:
        ind = OxmlElement("w:ind")
        ind.set(qn("w:left"), "0")
        ind.set(qn("w:firstLine"), "0")
        ppr.append(ind)
    jc = OxmlElement("w:jc")
    jc.set(qn("w:val"), align)
    ppr.append(jc)
    p.append(ppr)
    add_runs(p, text, size=size, bold=bold)
    return p


def table(rows: list[str]):
    cells = [[c.strip() for c in row.strip("|").split("|")] for row in rows if not re.fullmatch(r"\|[\s:|-]+\|", row)]
    columns = len(cells[0])
    # Column widths follow the longest text in each column, so short columns stay narrow
    longest = [max(max(min(len(r[i]) if i < len(r) else 0, 60) for r in cells) + 6, 12) for i in range(columns)]
    widths = [TEXT_WIDTH * n // sum(longest) for n in longest]
    widths[-1] += TEXT_WIDTH - sum(widths)

    tbl = OxmlElement("w:tbl")
    tblpr = OxmlElement("w:tblPr")
    tblw = OxmlElement("w:tblW")
    tblw.set(qn("w:w"), str(TEXT_WIDTH))
    tblw.set(qn("w:type"), "dxa")
    tblpr.append(tblw)
    borders = OxmlElement("w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        b = OxmlElement(f"w:{side}")
        b.set(qn("w:val"), "single")
        b.set(qn("w:sz"), "4")
        b.set(qn("w:space"), "0")
        b.set(qn("w:color"), "000000")
        borders.append(b)
    tblpr.append(borders)
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    tblpr.append(layout)
    margins = OxmlElement("w:tblCellMar")
    for side in ("left", "right"):
        m = OxmlElement(f"w:{side}")
        m.set(qn("w:w"), "80")
        m.set(qn("w:type"), "dxa")
        margins.append(m)
    tblpr.append(margins)
    tbl.append(tblpr)
    grid = OxmlElement("w:tblGrid")
    for w in widths:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(w))
        grid.append(col)
    tbl.append(grid)

    for r, row in enumerate(cells):
        tr = OxmlElement("w:tr")
        if r == 0:
            trpr = OxmlElement("w:trPr")
            header = OxmlElement("w:tblHeader")
            trpr.append(header)
            tr.append(trpr)
        for i in range(columns):
            tc = OxmlElement("w:tc")
            tcpr = OxmlElement("w:tcPr")
            tcw = OxmlElement("w:tcW")
            tcw.set(qn("w:w"), str(widths[i]))
            tcw.set(qn("w:type"), "dxa")
            tcpr.append(tcw)
            if r == 0:
                shd = OxmlElement("w:shd")
                shd.set(qn("w:val"), "clear")
                shd.set(qn("w:color"), "auto")
                shd.set(qn("w:fill"), "D9D9D9")
                tcpr.append(shd)
            tc.append(tcpr)
            tc.append(paragraph(row[i] if i < len(row) else "", after=0, align="left", size=20, bold=r == 0))
            tr.append(tc)
        tbl.append(tr)
    return tbl


def figure(doc, line: str) -> list:
    """'![Figure 1. Caption](diagrams/x.png)' => the picture, as wide as the text allows, and its caption."""
    caption, src = re.fullmatch(r"!\[(.*)\]\((.*)\)", line.strip()).groups()
    with Image.open(HERE / src) as img:
        ratio = img.height / img.width
    width = min(Inches(6.5), int(Inches(8) / ratio))  # tall diagrams fit the page height instead
    holder = doc.add_paragraph()  # python-docx adds pictures to a paragraph at the end; it's moved below
    holder.add_run().add_picture(str(HERE / src), width=width)
    picture = holder._p
    picture.getparent().remove(picture)
    ppr = OxmlElement("w:pPr")
    keep = OxmlElement("w:keepNext")
    ppr.append(keep)
    spacing = OxmlElement("w:spacing")
    spacing.set(qn("w:before"), "120")
    spacing.set(qn("w:after"), "60")
    ppr.append(spacing)
    jc = OxmlElement("w:jc")
    jc.set(qn("w:val"), "center")
    ppr.append(jc)
    picture.insert(0, ppr)
    return [picture, paragraph(f"*{caption}*", after=200, align="center", size=20)]


def add_bullet_numbering(doc):
    """A plain bullet list definition: the template has numbering only for its headings."""
    numbering = doc.part.numbering_part.element
    abstract = OxmlElement("w:abstractNum")
    abstract.set(qn("w:abstractNumId"), BULLET_NUM_ID)
    lvl = OxmlElement("w:lvl")
    lvl.set(qn("w:ilvl"), "0")
    for tag, val in (("w:start", "1"), ("w:numFmt", "bullet"), ("w:lvlText", "•"), ("w:lvlJc", "left")):
        el = OxmlElement(tag)
        el.set(qn("w:val"), val)
        lvl.append(el)
    ppr = OxmlElement("w:pPr")
    ind = OxmlElement("w:ind")
    ind.set(qn("w:left"), "360")
    ind.set(qn("w:hanging"), "360")
    ppr.append(ind)
    lvl.append(ppr)
    lvl.append(run_props())
    abstract.append(lvl)
    first_num = numbering.find(qn("w:num"))
    if first_num is not None:
        first_num.addprevious(abstract)
    else:
        numbering.append(abstract)
    num = OxmlElement("w:num")
    num.set(qn("w:numId"), BULLET_NUM_ID)
    ref = OxmlElement("w:abstractNumId")
    ref.set(qn("w:val"), BULLET_NUM_ID)
    num.append(ref)
    numbering.append(num)


def main() -> int:
    doc = Document(str(TEMPLATE))
    add_bullet_numbering(doc)
    wanted = sections()
    filled = []

    for heading in list(doc.paragraphs):
        name = heading.text.strip()
        if name not in wanted or not (heading.style.name.startswith("Heading") or name.startswith("Appendix")):
            continue
        # Remove the template's prompt paragraphs under this heading
        sibling = heading._p.getnext()
        while sibling is not None and sibling.tag == qn("w:p"):
            text = "".join(t.text or "" for t in sibling.iter(qn("w:t"))).strip()
            if not text.startswith("<"):
                break
            nxt = sibling.getnext()
            sibling.getparent().remove(sibling)
            sibling = nxt
        anchor = heading._p
        for kind, items in blocks(wanted[name]):
            if kind == "img":
                new = figure(doc, items[0])
            elif kind == "table":
                new = [table(items)]
            else:
                new = [paragraph(t, bullet=kind == "ul", after=60 if kind == "ul" else 120) for t in items]
            if kind == "ul":
                new[-1].find(qn("w:pPr")).find(qn("w:spacing")).set(qn("w:after"), "120")
            if kind == "table":
                new.append(paragraph("", after=0))
            for el in new:
                anchor.addnext(el)
                anchor = el
        filled.append(name)

    missing = [name for name in wanted if name not in filled]
    if missing:
        print("No template heading matches: " + ", ".join(missing), file=sys.stderr)
        return 1

    # Ask Word to refresh the table of contents when the file is opened
    settings = doc.settings.element
    if settings.find(qn("w:updateFields")) is None:
        update = OxmlElement("w:updateFields")
        update.set(qn("w:val"), "true")
        settings.append(update)

    doc.save(str(OUTPUT))
    print(f"Wrote {OUTPUT.name}: {len(filled)} sections filled ({', '.join(filled)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
