"""Builds docs/Tuklas User Manual.docx from the chapters in docs/manual/*.md, in the look of the
course's SRS template (its title page, styles, heading numbering, header and footer).

    python docs/manual/build.py     (from the repo root; needs python-docx and Pillow)

In each chapter file, "# " is a chapter (Heading 1), "## " a section and "### " a subsection. The
Markdown under them is described in docs/docx_blocks.py. Figures are numbered in order through the
whole manual, so a caption is written without its number: ![Signing in](screenshots/login.png).
The screenshots come from docs/manual/screenshots/take.cjs. Word fills in the table of contents
when the file is opened.
"""

import copy
import re
import sys
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from docx_blocks import Lists, fill_front_matter, refresh_fields_on_open, render  # noqa: E402

TEMPLATE = HERE.parent / "SRS Template.docx"
OUTPUT = HERE.parent / "Tuklas User Manual.docx"
TOC_FIELD = ' TOC \\h \\u \\z \\t "Heading 1,1,Heading 2,2,Heading 3,3," '


def chapters() -> list[tuple[int, str, list[str]]]:
    """(heading level, heading, the lines under it) from every chapter file, in file order."""
    found: list[tuple[int, str, list[str]]] = []
    figure = 0
    for md in sorted(HERE.glob("*.md")):
        for line in md.read_text(encoding="utf-8").splitlines():
            heading = re.match(r"(#{1,3}) (.+)", line)
            if heading:
                found.append((len(heading.group(1)), heading.group(2).strip(), []))
                continue
            if line.startswith("!["):
                figure += 1
                line = f"![Figure {figure}. {line[2:]}"
            if found:
                found[-1][2].append(line)
    return found


def field_run(kind: str, instruction: str | None = None):
    run = OxmlElement("w:r")
    if instruction is None:
        char = OxmlElement("w:fldChar")
        char.set(qn("w:fldCharType"), kind)
        run.append(char)
    else:
        text = OxmlElement("w:instrText")
        text.set(qn("xml:space"), "preserve")
        text.text = instruction
        run.append(text)
    return run


def empty_table_of_contents(doc):
    """Replace the template's SRS entries with an empty field that Word fills in on opening."""
    sdt = doc.element.body.find(qn("w:sdt"))
    content = sdt.find(qn("w:sdtContent"))
    first = content.find(qn("w:p"))
    ppr = first.find(qn("w:pPr"))
    for child in list(content):
        content.remove(child)
    p = OxmlElement("w:p")
    if ppr is not None:
        p.append(ppr)
    p.append(field_run("begin"))
    p.append(field_run("instr", TOC_FIELD))
    p.append(field_run("separate"))
    hint = OxmlElement("w:r")
    text = OxmlElement("w:t")
    text.text = "Word fills in the table of contents when the document is opened (or right-click here, then Update Field)."
    hint.append(text)
    p.append(hint)
    p.append(field_run("end"))
    content.append(p)


def heading_models(body) -> dict[int, OxmlElement]:
    """Copies of the template's first Heading 1 and Heading 2 paragraphs. They carry the numbering
    (1., 1.1) in their own formatting, not in the heading styles, so new headings are copied from them."""
    models = {}
    for p in body.iter(qn("w:p")):
        style = p.find(qn("w:pPr") + "/" + qn("w:pStyle"))
        level = {"Heading1": 1, "Heading2": 2}.get(style.get(qn("w:val")) if style is not None else "")
        if level and level not in models and "".join(p.itertext()).strip():
            models[level] = copy.deepcopy(p)
    return models


def heading(models, level: int, text: str):
    p = copy.deepcopy(models[min(level, 2)])
    # Each paragraph's Word id must be unique; a copy drops it and Word makes a new one
    for name in list(p.attrib):
        if name.endswith("}paraId") or name.endswith("}textId"):
            del p.attrib[name]
    run = copy.deepcopy(next(r for r in p.iter(qn("w:r")) if r.find(qn("w:t")) is not None))
    for child in list(p):
        if child.tag != qn("w:pPr"):
            p.remove(child)
    # The template turns "keep with next" off; a heading should never end a page
    ppr = p.find(qn("w:pPr"))
    keep = ppr.find(qn("w:keepNext"))
    if keep is None:
        keep = OxmlElement("w:keepNext")
        style = ppr.find(qn("w:pStyle"))
        if style is not None:
            style.addnext(keep)  # the schema wants it right after the style
        else:
            ppr.insert(0, keep)
    keep.set(qn("w:val"), "1")
    if level == 3:
        # A third level of the same numbering (1.1.1), in the Heading 3 style
        ppr = p.find(qn("w:pPr"))
        ppr.find(qn("w:pStyle")).set(qn("w:val"), "Heading3")
        ilvl = ppr.find(qn("w:numPr") + "/" + qn("w:ilvl"))
        if ilvl is not None:
            ilvl.set(qn("w:val"), "2")
    for t in run.findall(qn("w:t")):
        run.remove(t)
    for tab in run.findall(qn("w:tab")):
        run.remove(tab)
    t = OxmlElement("w:t")
    t.set(qn("xml:space"), "preserve")
    t.text = text
    run.append(t)
    p.append(run)
    return p


def rename_in_headers(doc):
    """The page header reads 'Software Requirements Specification for <Project>', split into pieces."""
    for section in doc.sections:
        for part in (section.header, section.first_page_header, section.even_page_header):
            for t in part._element.iter(qn("w:t")):
                if t.text == "Software":
                    t.text = "User"
                elif t.text and t.text.startswith("Requirements Specification"):
                    t.text = t.text.replace("Requirements Specification", "Manual", 1)


def main() -> int:
    doc = Document(str(TEMPLATE))
    body = doc.element.body
    models = heading_models(body)
    children = list(body)

    # Keep the title page, table of contents and revision history; drop the SRS sections after them
    first_heading = next(i for i, el in enumerate(children) if el.tag == qn("w:p") and el.find(".//" + qn("w:pStyle")) is not None
                         and el.find(".//" + qn("w:pStyle")).get(qn("w:val")) == "Heading1")
    for el in children[first_heading:]:
        if el.tag != qn("w:sectPr"):
            body.remove(el)
    final_section = body.find(qn("w:sectPr"))

    for p in doc.paragraphs[:4]:
        for run in p.runs:
            run.text = run.text.replace("Software Requirements Specification", "User Manual")
    rename_in_headers(doc)
    empty_table_of_contents(doc)

    lists = Lists(doc, circled_steps=True)
    count = 0
    for level, title, lines in chapters():
        final_section.addprevious(heading(models, level, title))
        for el in render(doc, lists, lines, HERE):
            final_section.addprevious(el)
        count += level == 1

    fill_front_matter(doc)
    refresh_fields_on_open(doc)
    doc.save(str(OUTPUT))
    print(f"Wrote {OUTPUT.name}: {count} chapters")
    return 0


if __name__ == "__main__":
    sys.exit(main())
