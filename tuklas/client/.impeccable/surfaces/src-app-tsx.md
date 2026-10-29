---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Tuklas app (all signed-in screens + login + public portfolio)

Mode: Operate (login and the public portfolio lean Persuade, but stay inside this world).
Audience/job: students track and share approved work; advisers review and sign off; admins act as the panel. Phone and desktop get equal weight.
Must not change: palette, Inter as the body face, the Classic look, dark mode, AA contrast, 44px targets, reduced-motion, server-enforced rules, prototype copy.
Memorable moment: the adviser's sign-off. The witness line draws in like a pen stroke and the gold seal stamps down. Each work's Defense-to-Discovery journey reads as dated notebook entries.
Signature features: verifiable seal (`/verify/:code`, APA/MLA citation) and the Defense-to-Discovery journey timeline.
Unresolved: the exact Tuko illustration poses (drawn in phase 2).

## Direction contract

THESIS: Every work is an entry in a witnessed research notebook, and adviser approval is the "Witnessed & understood by" line real lab notebooks carry. It refuses the campus-portal default of a white sidebar with floating cards and a glass top bar.

OWN-WORLD:
- Paper and grid: off-white #F8F9FD graph paper with a faint blue (#53C0E8 at low alpha) 8px grid that only shows in margins and headers. A blue margin rule.
- Navigation: lavender #ECE6FF section tabs on the page edge.
- Covers: purple #6C4AB6 bookcloth for covers, the login panel and active tabs. Purple appears only where you can act.
- Seal: gold #FFCB57 foil seal and stamp, with ink text.
- Vellum: frosted vellum (backdrop blur) for the header, modals, toasts and the command sheet.
- Neutrals: one 9-step lavender→ink ramp.
- Type: Archivo (wide display, condensed caps labels), Martian Mono (entry numbers, dates, seal codes), Inter (body).

STORY: A visitor sees that every entry is witnessed, opens one to read its journey and verify its seal, and leaves able to cite it. A student sees exactly where their work sits in its journey.

FIRST VIEWPORT:
- Desktop feed: lavender tab strip down the left edge, then a 4-cell margin with mono entry numbers and dates.
- Center column (about 680px): entries. Each has an author line with a type tag beside it, an Archivo title, the abstract, and a footer with the witness line plus the gold seal.
- Right: a vellum-backed events strip.
- Header: frosted vellum bar with search and the primary "New entry" action at top right.
- Phone: the tabs become a bottom bar.

FORM: Research Notebook, position 7 of the grounded list; seed key 198855d7. Raises: one grid geometry drives all spacing (from Zoo map), action-only purple (from Warm app), a stepped neutral ramp (from Darkroom record). Motion grammar: vellum sheets slide with mass, the witness line draws, the seal stamps, and entries settle onto the grid lines.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
