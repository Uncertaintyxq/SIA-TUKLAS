"""Builds docs/Tuklas QA Checklist.docx, the testers' checklist, from docs/qa/checklist.md.

    python docs/qa/build.py

Each "## " heading becomes a section with a table of numbered checks (1.1, 1.2, ...): the check,
Pass and Fail boxes, and room for notes. "- [Dev] " checks are labelled as needing server access.
The "Use:" line under a heading is printed above its table. Needs python-docx.
"""

import re
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "checklist.md"
OUTPUT = HERE.parent / "Tuklas QA Checklist.docx"

SITE = "https://tuklas-sia-jm.japaneast.cloudapp.azure.com"
FONT = "Calibri"
BOX_FONT = "Segoe UI Symbol"
HEADER_FILL = "1F3864"
DEV_COLOR = RGBColor(0x8A, 0x4B, 0x08)
DEV_FILL = "FBE9D0"

ACCOUNTS = [
    ("Andrea Villanueva", "Student", "Tuklas University", "Author of works; leader in a group"),
    ("Paolo Reyes", "Student", "Tuklas University", "Reader, reporter, second chat person"),
    ("Kim Dela Cruz", "Student", "Tuklas University", "Group member"),
    ("Dr. Maria Santos", "Educator", "Tuklas University", "Research adviser; all three rights"),
    ("Prof. Ramon Aquino", "Educator", "Tuklas University", "Another adviser (not Andrea's)"),
    ("Prof. Carla Javier", "Educator", "Tuklas University", "Not verified yet"),
    ("Lea Mercado", "Super-admin", "Tuklas University", "Acts for every school"),
    ("Miguel Torres", "Student", "Bayan State College", "The other school's student"),
    ("Dr. Ana Lim", "Educator", "Bayan State College", "The other school's adviser"),
    ("Rina Cruz", "Student", "Bayan State College", "Waiting for Bayan to confirm her"),
    ("Jose Ramos", "Admin", "Bayan State College", "Bayan's own Admin"),
]

HOW_TO = [
    f"Test on the staging site, {SITE}. It turns itself off at 11:00 PM Philippine time.",
    'Sign in with the one-click demo logins on the sign-in page. The password for every demo account is tuklas123. '
    "If Tuklas asks you to set up two-factor sign-in, scan the code with an authenticator app on your phone "
    "(for example, Google Authenticator or Microsoft Authenticator).",
    'Many checks need two people at once. Use a second browser, or a private window, signed in as the other person.',
    '"Reset demo data" in the user menu puts the site back as it started, for every tester at once. '
    "Agree with the other testers before you use it, and use it after checks that can't be undone "
    "(approving, rejecting, deleting an account, changing roles).",
    "For each check, tick Pass or Fail. If you couldn't test it, leave both empty and write why in Notes.",
    "For every Fail, add a line to the Issue log at the end, with a screenshot named after the check "
    '(for example, "5.11.png").',
    'Checks labelled DEV need server access (for example, the emails, which staging writes to the server\'s log). '
    "Leave them to a developer.",
]


def shade(cell, fill: str) -> None:
    props = cell._tc.get_or_add_tcPr()
    shading = OxmlElement("w:shd")
    shading.set(qn("w:val"), "clear")
    shading.set(qn("w:color"), "auto")
    shading.set(qn("w:fill"), fill)
    props.append(shading)


def keep_row_whole(row, header: bool = False) -> None:
    props = row._tr.get_or_add_trPr()
    props.append(OxmlElement("w:cantSplit"))
    if header:
        props.append(OxmlElement("w:tblHeader"))


def set_widths(table, widths: list[float]) -> None:
    table.autofit = False
    for row in table.rows:
        for cell, width in zip(row.cells, widths):
            cell.width = Inches(width)


def write(cell, text: str, bold: bool = False, size: float = 10, color: RGBColor | None = None) -> None:
    paragraph = cell.paragraphs[0]
    paragraph.paragraph_format.space_after = Pt(0)
    run = paragraph.add_run(text)
    run.bold = bold
    run.font.size = Pt(size)
    if color is not None:
        run.font.color.rgb = color


def header_row(table, titles: list[str]) -> None:
    row = table.rows[0]
    keep_row_whole(row, header=True)
    for cell, title in zip(row.cells, titles):
        write(cell, title, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
        shade(cell, HEADER_FILL)


def field(paragraph, code: str) -> None:
    """Adds a Word field, such as PAGE, that Word fills in."""
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instruction = OxmlElement("w:instrText")
    instruction.set(qn("xml:space"), "preserve")
    instruction.text = code
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instruction)
    run._r.append(end)


def keep_with_next(paragraph) -> None:
    paragraph.paragraph_format.keep_with_next = True


def sections(text: str) -> list[tuple[str, str, list[str]]]:
    """(heading, use line, checks) for each "## " section of checklist.md."""
    out: list[tuple[str, str, list[str]]] = []
    for line in text.splitlines():
        if line.startswith("## "):
            out.append((line[3:].strip(), "", []))
        elif out and line.startswith("Use: "):
            out[-1] = (out[-1][0], line[5:].strip(), out[-1][2])
        elif out and line.startswith("- "):
            out[-1][2].append(line[2:].strip())
    return out


def setup(doc: Document) -> None:
    section = doc.sections[0]
    section.orientation = WD_ORIENT.PORTRAIT
    section.page_width, section.page_height = Inches(8.5), Inches(11)
    for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(section, side, Inches(0.75))

    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(11)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    for name, size in (("Title", 24), ("Heading 1", 14), ("Heading 2", 12)):
        style = doc.styles[name]
        style.font.name = FONT
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor(0x1F, 0x38, 0x64)
        fonts = style.element.rPr.rFonts
        for theme in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
            fonts.attrib.pop(qn(theme), None)  # use the font above, not the theme's
        style.paragraph_format.keep_with_next = True

    doc.styles["Footer"].font.size = Pt(9)  # the page-number fields take the style's size
    header = section.header.paragraphs[0]
    header.text = "Tuklas QA Checklist · Release 1.0"
    header.runs[0].font.size = Pt(9)
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.add_run("Page ").font.size = Pt(9)
    field(footer, "PAGE")
    footer.add_run(" of ").font.size = Pt(9)
    field(footer, "NUMPAGES")


def front(doc: Document, total: int) -> None:
    doc.add_paragraph("Tuklas QA Checklist", style="Title")
    doc.add_paragraph(f"Release 1.0 · {total} checks in 17 areas. Fill in one copy per tester.")

    details = doc.add_table(rows=6, cols=2, style="Table Grid")
    labels = ["Tester", "Date(s) tested", "Site tested", "Computer and browser", "Phone and browser",
              "Result"]
    values = ["", "", SITE, "", "", "_____ passed   _____ failed   _____ not tested"]
    for row, label, value in zip(details.rows, labels, values):
        write(row.cells[0], label, bold=True)
        shade(row.cells[0], "E8ECF4")
        write(row.cells[1], value)
        row.height = Inches(0.32)
    set_widths(details, [1.8, 5.2])

    doc.add_paragraph("How to test", style="Heading 1")
    for item in HOW_TO:
        doc.add_paragraph(item, style="List Bullet")

    doc.add_paragraph("Demo accounts", style="Heading 1")
    keep_with_next(doc.add_paragraph("The checks name the account to sign in as. All use the password tuklas123."))
    table = doc.add_table(rows=1 + len(ACCOUNTS), cols=4, style="Table Grid")
    header_row(table, ["Name", "Role", "School", "Used for"])
    for row, account in zip(table.rows[1:], ACCOUNTS):
        keep_row_whole(row)
        for cell, value in zip(row.cells, account):
            write(cell, value)
    set_widths(table, [1.8, 1.1, 1.7, 2.4])


def checklist(doc: Document, parsed: list[tuple[str, str, list[str]]]) -> None:
    for heading, use, checks in parsed:
        number = heading.split(".")[0]
        title = doc.add_paragraph(heading, style="Heading 1")
        title.paragraph_format.page_break_before = number == "1"
        if use:
            line = doc.add_paragraph()
            line.add_run("Use: ").bold = True
            line.add_run(use)
            keep_with_next(line)

        table = doc.add_table(rows=1 + len(checks), cols=4, style="Table Grid")
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        header_row(table, ["No.", "Check", "Result", "Notes"])
        for i, (row, check) in enumerate(zip(table.rows[1:], checks), start=1):
            keep_row_whole(row)
            write(row.cells[0], f"{number}.{i}", bold=True)
            dev = check.startswith("[Dev] ")
            if dev:
                write(row.cells[1], "DEV  ", bold=True, size=8, color=DEV_COLOR)
                check = check[len("[Dev] "):]
                shade(row.cells[1], DEV_FILL)
            row.cells[1].paragraphs[0].add_run(check).font.size = Pt(10)
            result = row.cells[2].paragraphs[0]
            result.paragraph_format.space_after = Pt(0)
            for label in ("Pass", "Fail"):
                box = result.add_run("☐ ")
                box.font.name = BOX_FONT
                box.font.size = Pt(11)
                result.add_run(label + ("\n" if label == "Pass" else "")).font.size = Pt(10)
        set_widths(table, [0.5, 3.95, 0.8, 1.75])


def issue_log(doc: Document) -> None:
    title = doc.add_paragraph("Issue log", style="Heading 1")
    title.paragraph_format.page_break_before = True
    keep_with_next(doc.add_paragraph(
        "One line for every Fail. Severity: Blocker (stops the check or loses data), Major (wrong result, "
        "with a way around it) or Minor (looks or wording)."))
    rows = 13  # fills the page; one more pushes the paragraph after the table onto a blank page
    table = doc.add_table(rows=1 + rows, cols=6, style="Table Grid")
    header_row(table, ["No.", "Check", "What happened, and what you expected", "Steps to repeat",
                       "Severity", "Screenshot"])
    for i, row in enumerate(table.rows[1:], start=1):
        keep_row_whole(row)
        row.height = Inches(0.55)
        write(row.cells[0], str(i))
    set_widths(table, [0.4, 0.6, 2.4, 2.0, 0.8, 0.8])


def main() -> None:
    parsed = sections(SOURCE.read_text(encoding="utf-8"))
    doc = Document()
    setup(doc)
    front(doc, sum(len(checks) for _, _, checks in parsed))
    checklist(doc, parsed)
    issue_log(doc)
    doc.save(OUTPUT)
    print(f"Wrote {OUTPUT} ({len(parsed)} areas)")


if __name__ == "__main__":
    main()
