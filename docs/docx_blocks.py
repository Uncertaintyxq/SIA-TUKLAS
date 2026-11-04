"""Turns the simple Markdown used in docs/srs/ and docs/manual/ into Word paragraphs, lists, tables and
figures, in the look of the course template (Times 11 pt body, black text). Used by
docs/srs/build.py and docs/manual/build.py; needs python-docx and Pillow.

Supported, one block per run of lines (a blank line ends a block):
    paragraphs            lines next to each other join into one paragraph
    - item                a bullet list
    1. step               a numbered list; each list starts again at 1
    > Note: text          a boxed note
    | a | b |             a table; the first row is its header
    ![Caption](file.png)  a figure: the picture, as wide as the text, and its caption below
Inside text: **bold** and *italic*.
"""

import re
from pathlib import Path

from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches
from PIL import Image

BODY_FONT = "Times"
TEXT_WIDTH = 9360  # 6.5 inches in twentieths of a point: a Letter page less its 1-inch margins
BULLET_ID = 90
STEPS_ID = 91


def _el(tag: str, **attrs) -> OxmlElement:
    el = OxmlElement(tag)
    for name, value in attrs.items():
        el.set(qn("w:" + name), str(value))
    return el


def blocks(lines: list[str]) -> list[tuple[str, list[str]]]:
    """Groups lines into (kind, items) blocks: 'p', 'ul', 'ol', 'note', 'table' or 'img'."""
    out: list[tuple[str, list[str]]] = []
    previous_blank = True
    for line in lines + [""]:
        if not line.strip():
            previous_blank = True
            continue
        if line.startswith("!["):
            out.append(("img", [line.strip()]))
            previous_blank = True
            continue
        if line.startswith("- "):
            kind, text = "ul", line[2:]
        elif re.match(r"\d+\. ", line):
            kind, text = "ol", re.sub(r"^\d+\. ", "", line)
        elif line.startswith("> "):
            kind, text = "note", line[2:]
        elif line.startswith("|"):
            kind, text = "table", line.strip()
        else:
            kind, text = "p", line.strip()
        # A blank line ends a paragraph, a note or a list; table rows and list items run on
        same = out and out[-1][0] == kind and not (previous_blank and kind != "table")
        if same and kind in ("p", "note"):
            out[-1][1][0] += " " + text.strip()
        elif same:
            out[-1][1].append(text)
        else:
            out.append((kind, [text]))
        previous_blank = False
    return out


def run_props(bold=False, italic=False, size=22, font=BODY_FONT):
    rpr = OxmlElement("w:rPr")
    rpr.append(_el("w:rFonts", ascii=font, hAnsi=font, cs=font, eastAsia=font))
    rpr.append(_el("w:b", val=1 if bold else 0))
    rpr.append(_el("w:i", val=1 if italic else 0))
    rpr.append(_el("w:color", val="000000"))
    rpr.append(_el("w:sz", val=size))
    rpr.append(_el("w:szCs", val=size))
    return rpr


def add_runs(p, text: str, size=22, bold=False):
    """Appends text with **bold** and *italic* spans as runs."""
    for part in re.split(r"(\*\*[^*]+\*\*|\*[^*]+\*)", text):
        if not part:
            continue
        is_bold = part.startswith("**")
        is_italic = not is_bold and part.startswith("*")
        run = OxmlElement("w:r")
        run.append(run_props(bold=bold or is_bold, italic=is_italic, size=size))
        t = OxmlElement("w:t")
        t.set(qn("xml:space"), "preserve")
        t.text = part.strip("*") if (is_bold or is_italic) else part
        run.append(t)
        p.append(run)


def paragraph(text: str, *, num_id=None, after=120, align="both", size=22, bold=False, boxed=False, keep_next=False):
    p = OxmlElement("w:p")
    ppr = OxmlElement("w:pPr")
    if keep_next:
        ppr.append(OxmlElement("w:keepNext"))
    if num_id is not None:
        num = OxmlElement("w:numPr")
        num.append(_el("w:ilvl", val=0))
        num.append(_el("w:numId", val=num_id))
        ppr.append(num)
    if boxed:
        borders = OxmlElement("w:pBdr")
        for side in ("top", "left", "bottom", "right"):
            borders.append(_el(f"w:{side}", val="single", sz=4, space=4, color="7F7F7F"))
        ppr.append(borders)
        ppr.append(_el("w:shd", val="clear", color="auto", fill="F2F2F2"))
    ppr.append(_el("w:spacing", before=120 if boxed else 0, after=after, line=240, lineRule="auto"))
    if num_id is None:
        ppr.append(_el("w:ind", left=80 if boxed else 0, right=80 if boxed else 0, firstLine=0))
    ppr.append(_el("w:jc", val=align))
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
    tblpr.append(_el("w:tblW", w=TEXT_WIDTH, type="dxa"))
    borders = OxmlElement("w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        borders.append(_el(f"w:{side}", val="single", sz=4, space=0, color="000000"))
    tblpr.append(borders)
    tblpr.append(_el("w:tblLayout", type="fixed"))
    margins = OxmlElement("w:tblCellMar")
    margins.append(_el("w:left", w=80, type="dxa"))
    margins.append(_el("w:right", w=80, type="dxa"))
    tblpr.append(margins)
    tbl.append(tblpr)
    grid = OxmlElement("w:tblGrid")
    for w in widths:
        grid.append(_el("w:gridCol", w=w))
    tbl.append(grid)

    for r, row in enumerate(cells):
        tr = OxmlElement("w:tr")
        if r == 0:
            trpr = OxmlElement("w:trPr")
            trpr.append(OxmlElement("w:tblHeader"))
            tr.append(trpr)
        for i in range(columns):
            tc = OxmlElement("w:tc")
            tcpr = OxmlElement("w:tcPr")
            tcpr.append(_el("w:tcW", w=widths[i], type="dxa"))
            if r == 0:
                tcpr.append(_el("w:shd", val="clear", color="auto", fill="D9D9D9"))
            tc.append(tcpr)
            tc.append(paragraph(row[i] if i < len(row) else "", after=0, align="left", size=20, bold=r == 0))
            tr.append(tc)
        tbl.append(tr)
    return tbl


def figure(doc, line: str, base: Path) -> list:
    """'![Figure 1. Caption](diagrams/x.png)' => the picture, as wide as the text allows, and its caption."""
    caption, src = re.fullmatch(r"!\[(.*)\]\((.*)\)", line).groups()
    with Image.open(base / src) as img:
        ratio = img.height / img.width
    width = min(Inches(6.5), int(Inches(7.5) / ratio))  # tall pictures fit the page height instead
    holder = doc.add_paragraph()  # python-docx adds pictures to a paragraph at the end; it's moved below
    holder.add_run().add_picture(str(base / src), width=width)
    picture = holder._p
    picture.getparent().remove(picture)
    ppr = OxmlElement("w:pPr")
    ppr.append(OxmlElement("w:keepNext"))
    ppr.append(_el("w:spacing", before=120, after=60))
    ppr.append(_el("w:jc", val="center"))
    picture.insert(0, ppr)
    return [picture, paragraph(f"*{caption}*", after=200, align="center", size=20)]


class Lists:
    """Bullet and numbered list definitions added to a document. The template only numbers its headings."""

    def __init__(self, doc):
        self.numbering = doc.part.numbering_part.element
        self._abstract(BULLET_ID, "bullet", "•")
        self._abstract(STEPS_ID, "decimal", "%1.")
        self._num(BULLET_ID, BULLET_ID)
        self.next_id = STEPS_ID + 1

    def _abstract(self, abstract_id, fmt, text):
        abstract = _el("w:abstractNum", abstractNumId=abstract_id)
        lvl = _el("w:lvl", ilvl=0)
        for tag, val in (("w:start", 1), ("w:numFmt", fmt), ("w:lvlText", text), ("w:lvlJc", "left")):
            lvl.append(_el(tag, val=val))
        ppr = OxmlElement("w:pPr")
        ppr.append(_el("w:ind", left=360, hanging=360))
        lvl.append(ppr)
        lvl.append(run_props())
        abstract.append(lvl)
        first_num = self.numbering.find(qn("w:num"))
        if first_num is not None:
            first_num.addprevious(abstract)  # abstract definitions come before every w:num
        else:
            self.numbering.append(abstract)

    def _num(self, num_id, abstract_id, restart=False):
        num = _el("w:num", numId=num_id)
        num.append(_el("w:abstractNumId", val=abstract_id))
        if restart:
            override = _el("w:lvlOverride", ilvl=0)
            override.append(_el("w:startOverride", val=1))
            num.append(override)
        self.numbering.append(num)

    def new_steps(self) -> int:
        """A numbered list that starts at 1."""
        num_id = self.next_id
        self.next_id += 1
        self._num(num_id, STEPS_ID, restart=True)
        return num_id


def render(doc, lists: Lists, lines: list[str], base: Path) -> list:
    """The Word elements for these Markdown lines, in order."""
    out = []
    for kind, items in blocks(lines):
        if kind == "img":
            out += figure(doc, items[0], base)
        elif kind == "table":
            out += [table(items), paragraph("", after=0)]
        elif kind == "note":
            out.append(paragraph(items[0], boxed=True, after=160, align="left"))
        elif kind in ("ul", "ol"):
            num_id = BULLET_ID if kind == "ul" else lists.new_steps()
            for i, text in enumerate(items):
                out.append(paragraph(text, num_id=num_id, after=120 if i == len(items) - 1 else 60))
        else:
            out.append(paragraph(items[0]))
    return out


def refresh_fields_on_open(doc):
    """Ask Word to refresh the table of contents (and other fields) when the file is opened."""
    settings = doc.settings.element
    if settings.find(qn("w:updateFields")) is None:
        settings.append(_el("w:updateFields", val="true"))
