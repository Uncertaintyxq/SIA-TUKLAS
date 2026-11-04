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

import sys
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from docx_blocks import Lists, refresh_fields_on_open, render  # noqa: E402

TEMPLATE = HERE.parent / "SRS Template.docx"
OUTPUT = HERE.parent / "Tuklas SRS.docx"


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


def main() -> int:
    doc = Document(str(TEMPLATE))
    lists = Lists(doc)
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
        for el in render(doc, lists, wanted[name], HERE):
            anchor.addnext(el)
            anchor = el
        filled.append(name)

    missing = [name for name in wanted if name not in filled]
    if missing:
        print("No template heading matches: " + ", ".join(missing), file=sys.stderr)
        return 1

    refresh_fields_on_open(doc)
    doc.save(str(OUTPUT))
    print(f"Wrote {OUTPUT.name}: {len(filled)} sections filled ({', '.join(filled)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
