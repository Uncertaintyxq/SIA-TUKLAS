"""Builds docs/Tuklas Demo Script.docx from docs/slides/demo-script.md. Needs python-docx.

    python docs/slides/build_demo.py

Supported Markdown, one block per run of lines: "# " title, "## " heading, paragraphs, "- [ ] "
checkboxes, "- " bullets, "1. " numbered steps (each list starts again at 1), and tables (the first
row is the header). Inside text: **bold** and *italic*. A step or paragraph that is entirely in
italics is a line to say aloud, and is shown in a shaded box.
"""

import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "demo-script.md"
OUTPUT = HERE.parent / "Tuklas Demo Script.docx"

FONT = "Calibri"
PURPLE = RGBColor(0x3B, 0x2A, 0x6B)
SAY_FILL = "F3F0FA"
HEADER_FILL = "3B2A6B"


def shade(element, fill: str) -> None:
    props = element.get_or_add_pPr() if element.tag == qn("w:p") else element.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    props.append(shd)


def box(paragraph) -> None:
    """A thin border around a paragraph, for the lines to say aloud."""
    borders = OxmlElement("w:pBdr")
    for side in ("top", "left", "bottom", "right"):
        b = OxmlElement(f"w:{side}")
        b.set(qn("w:val"), "single")
        b.set(qn("w:sz"), "4")
        b.set(qn("w:space"), "4")
        b.set(qn("w:color"), "8E7CC3")
        borders.append(b)
    paragraph._p.get_or_add_pPr().append(borders)


def add_text(paragraph, text: str, *, color=None, size=None, bold=False) -> None:
    """Adds text with **bold** and *italic* runs."""
    for piece in re.split(r"(\*\*[^*]+\*\*|\*[^*]+\*)", text):
        if not piece:
            continue
        run = paragraph.add_run(piece.strip("*") if piece.startswith("*") else piece)
        run.bold = bold or piece.startswith("**")
        run.italic = piece.startswith("*") and not piece.startswith("**")
        if color:
            run.font.color.rgb = color
        if size:
            run.font.size = size


def is_spoken(text: str) -> bool:
    return bool(re.fullmatch(r"\*[^*]+\*", text.strip()))


def spoken(doc, text: str, style=None) -> None:
    p = doc.add_paragraph(style=style)
    add_text(p, "Say: ", bold=True, color=PURPLE)
    add_text(p, text.strip())
    shade(p._p, SAY_FILL)
    box(p)
    p.paragraph_format.space_after = Pt(6)


def numbered(doc, text: str, restart: bool) -> None:
    """A numbered step; spoken steps keep their number and get the shaded box."""
    style = "List Number"
    if is_spoken(text):
        spoken(doc, text, style)
        p = doc.paragraphs[-1]
    else:
        p = doc.add_paragraph(style=style)
        add_text(p, text)
    if restart:
        restart_numbering(doc, p)


def restart_numbering(doc, paragraph) -> None:
    """Starts a new list at 1: a new w:num pointing at the List Number style's abstract numbering."""
    numbering = doc.part.numbering_part.numbering_definitions._numbering
    style_num = doc.styles["List Number"]._element.pPr.numPr.numId.val
    abstract = numbering.num_having_numId(style_num).abstractNumId.val
    num = numbering.add_num(abstract)
    override = num.add_lvlOverride(ilvl=0)
    override.add_startOverride(1)
    num_pr = paragraph._p.get_or_add_pPr().get_or_add_numPr()
    num_pr.get_or_add_ilvl().val = 0
    num_pr.get_or_add_numId().val = num.numId


def table(doc, rows: list[str]) -> None:
    cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows if not re.fullmatch(r"\|[\s|:-]+\|", r.strip())]
    t = doc.add_table(rows=len(cells), cols=len(cells[0]), style="Table Grid")
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for r, row in enumerate(cells):
        for c, value in enumerate(row):
            cell = t.rows[r].cells[c]
            p = cell.paragraphs[0]
            if r == 0:
                add_text(p, value, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
                shade(cell._tc, HEADER_FILL)
            else:
                add_text(p, value)
            p.paragraph_format.space_after = Pt(2)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def main() -> int:
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    doc = Document()
    for section in doc.sections:
        section.left_margin = section.right_margin = Inches(0.9)
        section.top_margin = section.bottom_margin = Inches(0.8)
    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(11)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    for name, size in (("Title", 24), ("Heading 1", 15)):
        style = doc.styles[name]
        style.font.name = FONT
        style.font.color.rgb = PURPLE
        style.font.size = Pt(size)
        style.element.rPr.rFonts.set(qn("w:asciiTheme"), "")  # use FONT, not the theme's
        style.element.rPr.rFonts.set(qn("w:ascii"), FONT)
        style.element.rPr.rFonts.set(qn("w:hAnsi"), FONT)

    i = 0
    first_step = True
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            first_step = True
            i += 1
            continue
        if line.startswith("# "):
            doc.add_paragraph(line[2:].strip(), style="Title")
        elif line.startswith("## "):
            h = doc.add_paragraph(line[3:].strip(), style="Heading 1")
            h.paragraph_format.keep_with_next = True
        elif stripped.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(lines[i])
                i += 1
            table(doc, rows)
            continue
        elif stripped.startswith("- [ ] "):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.3)
            p.paragraph_format.first_line_indent = Inches(-0.3)
            p.paragraph_format.space_after = Pt(3)
            p.add_run("☐  ").font.size = Pt(12)
            add_text(p, stripped[6:])
        elif stripped.startswith("- "):
            p = doc.add_paragraph(style="List Bullet")
            add_text(p, stripped[2:])
        elif re.match(r"\d+\. ", stripped):
            numbered(doc, re.sub(r"^\d+\. ", "", stripped), restart=first_step)
            first_step = False
        else:
            # A paragraph: following lines join it until a blank line or another block
            text = [stripped]
            while i + 1 < len(lines) and lines[i + 1].strip() and not re.match(r"(#|\||- |\d+\. )", lines[i + 1].strip()):
                i += 1
                text.append(lines[i].strip())
            joined = " ".join(text)
            if is_spoken(joined):
                spoken(doc, joined)
            else:
                add_text(doc.add_paragraph(), joined)
        i += 1

    doc.save(str(OUTPUT))
    print(f"Wrote {OUTPUT.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
