# Reference

Client requirements and design records for Tuklas. Read these before changing scope, rules or the look.
Each `.pdf` is the original record. The `.md` files hold the same text in searchable form.

| File | What it is |
|---|---|
| [August_31_2026.md](August_31_2026.md) · `.pdf` | Kickoff meeting with the client (Bamie Bucog): scope, approval rule, ads, timeline, plus the written Q&A |
| [October_1_2026.md](October_1_2026.md) · `.pdf` · `.docx` | UI design progress: login screen, palette, open questions |
| `prototype.html` | Working single-file prototype: the feature spec, copy and demo data (also at the repo root as `index.html`) |

## Client requirements in short

1. **Two purposes in one product:** public academic portfolios, plus a social-style hub for research discovery. It is not general social media.
2. **Approval before publishing:** student work goes public only after a research adviser or academic panel approves it.
3. **Academic ads only:** research colloquiums, school innovations, the C.P. Garcia event. No commercial content.
4. **Portfolio order:** Research & Literary Works first, then Academic Background (diplomas, degrees), then Honors & Awards (awards, grants, certifications).
5. **Build first:** the public-facing portfolio.
6. **Look:** several appearance options, including one inspired by early-to-mid-2000s LinkedIn.
7. **Users:** students, academic peers, hiring committees. Advisers post student research; everyone else engages with it.
8. **Process:** incremental builds, bi-weekly reviews, deadline in the first week of November 2026.

## Where the build stands against these

| Requirement | Status |
|---|---|
| Approval before publishing | Enforced on the server (`server/src/policies/works.ts`) |
| Academic-only ads | Enforced by the `EventCategory` enum and admin approval |
| Portfolio order | Built (`/u/<username>`) |
| Appearance options | Modern and Classic (2000s LinkedIn), each light or dark |
| "Educator" vs "Research adviser" | Settled: "Educator" is the role, "Research adviser" is used in review copy (PLAN.md §8) |
| Personal quotes on how the research was made (Q&A 2a) | **Not built.** Works have no field for it |
| Advisers post their students' papers (Q&A 6) | **Different in the build:** students submit, and the adviser reviews and approves |
