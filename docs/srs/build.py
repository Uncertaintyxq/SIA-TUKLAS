"""Builds docs/Tuklas SRS.docx: the course template (docs/SRS Template.docx) filled in with the text
of each section in docs/srs/*.md. Sections that aren't written yet keep the template's prompts.

    python docs/srs/build.py        (from the repo root; needs python-docx and Pillow)

Each .md file holds one template section. A "## <heading>" line names the template heading whose
prompt it replaces, spelled as in the template. The Markdown under it is described in
docs/docx_blocks.py. Each diagram's source is a .drawio file next to its .png: edit it in draw.io,
then export it with
    draw.io --export --format png --scale 2 --border 16 --output name.png name.drawio
The template's styles, numbering and table of contents are kept; Word refreshes the page numbers in
the table of contents when the file is opened.
"""

import copy
import sys
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from docx_blocks import Lists, fill_front_matter, refresh_fields_on_open, render  # noqa: E402

TEMPLATE = HERE.parent / "SRS Template.docx"
OUTPUT = HERE.parent / "Tuklas SRS.docx"
# Diagrams may fill most of a page: the SRS has no steps to keep beside them
FIGURE_HEIGHT = 8.0


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


def system_features(doc, lists, heading, lines: list[str]) -> None:
    """Section 4 holds any number of features, so it is rebuilt from the template's one sample:
    each "### Feature" becomes a Heading 2 like "System Feature 1", and each "#### Part" a numbered
    line like "4.1.1 Description and Priority", in the template's own formatting."""
    body = heading._p.getparent()
    following = []
    el = heading._p.getnext()
    while el is not None and not (el.tag == qn("w:p") and el.find(".//" + qn("w:pStyle")) is not None
                                  and el.find(".//" + qn("w:pStyle")).get(qn("w:val")) == "Heading1"):
        following.append(el)
        el = el.getnext()
    text = lambda p: "".join(t.text or "" for t in p.iter(qn("w:t"))).strip()  # noqa: E731
    feature_model = copy.deepcopy(next(p for p in following if text(p) == "System Feature 1"))
    part_model = copy.deepcopy(next(p for p in following if text(p).startswith("4.1.1")))
    for p in following:
        body.remove(p)

    def titled(model, title):
        p = copy.deepcopy(model)
        for name in list(p.attrib):  # each paragraph's Word id must be unique
            if name.endswith("}paraId") or name.endswith("}textId"):
                del p.attrib[name]
        # A heading never ends a page: keep it with what follows
        ppr = p.find(qn("w:pPr"))
        keep = ppr.find(qn("w:keepNext"))
        if keep is None:
            keep = OxmlElement("w:keepNext")
            style = ppr.find(qn("w:pStyle"))
            if style is not None:
                style.addnext(keep)
            else:
                ppr.insert(0, keep)
        keep.set(qn("w:val"), "1")
        runs = [r for r in p.iter(qn("w:r")) if r.find(qn("w:t")) is not None]
        for r in runs[1:]:
            r.getparent().remove(r)
        for child in list(runs[0]):
            if child.tag in (qn("w:t"), qn("w:tab")):
                runs[0].remove(child)
        for i, piece in enumerate(title.split("\t")):
            if i:
                runs[0].append(OxmlElement("w:tab"))
            t = OxmlElement("w:t")
            t.set(qn("xml:space"), "preserve")
            t.text = piece
            runs[0].append(t)
        return p

    anchor = heading._p
    chunk: list[str] = []
    feature = part = 0

    def flush():
        nonlocal anchor
        for new in render(doc, lists, chunk, HERE, FIGURE_HEIGHT):
            anchor.addnext(new)
            anchor = new
        chunk.clear()

    for line in lines + ["### "]:
        if line.startswith("### ") or line.startswith("#### "):
            flush()
            if line == "### ":
                break
            if line.startswith("### "):
                feature, part = feature + 1, 0
                new = titled(feature_model, line[4:].strip())
            else:
                part += 1
                new = titled(part_model, f"4.{feature}.{part}\t{line[5:].strip()}")
            anchor.addnext(new)
            anchor = new
        else:
            chunk.append(line)


def main() -> int:
    doc = Document(str(TEMPLATE))
    lists = Lists(doc)
    wanted = sections()
    filled = []

    for heading in list(doc.paragraphs):
        name = heading.text.strip()
        if name not in wanted or not (heading.style.name.startswith("Heading") or name.startswith("Appendix")):
            continue
        if name == "System Features":
            system_features(doc, lists, heading, wanted[name])
            filled.append(name)
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
        for el in render(doc, lists, wanted[name], HERE, FIGURE_HEIGHT):
            anchor.addnext(el)
            anchor = el
        filled.append(name)

    missing = [name for name in wanted if name not in filled]
    if missing:
        print("No template heading matches: " + ", ".join(missing), file=sys.stderr)
        return 1

    # The appendix titles are plain paragraphs in the template, so the table of contents misses them.
    # Heading 1 with its numbering switched off puts them in it; their own formatting keeps their look.
    for p in doc.paragraphs:
        ppr = p._p.find(qn("w:pPr"))
        if not p.text.strip().startswith("Appendix ") or ppr is None or ppr.find(qn("w:pStyle")) is not None:
            continue
        style = OxmlElement("w:pStyle")
        style.set(qn("w:val"), "Heading1")
        ppr.insert(0, style)
        numbering = OxmlElement("w:numPr")
        num_id = OxmlElement("w:numId")
        num_id.set(qn("w:val"), "0")
        numbering.append(num_id)
        style.addnext(numbering)

    fill_front_matter(doc)
    refresh_fields_on_open(doc)
    doc.save(str(OUTPUT))
    print(f"Wrote {OUTPUT.name}: {len(filled)} sections filled ({', '.join(filled)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
