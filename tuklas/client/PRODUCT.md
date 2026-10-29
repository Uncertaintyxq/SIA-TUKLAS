# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Students** submit research and literary works, track adviser review, and share a public portfolio. They use phones and laptops about equally.
- **Educators (research advisers)** review advisees' work: comment, request revisions, sign off. They also post mentorships, grants and calls for submissions, and promote academic events.
- **Admins (Office of Research & Publications)** act as the academic panel: approve research, verify honors and grants, and moderate event ads.
- **Public visitors** (logged out) view a student's portfolio through a shared link: approved works and verified honors only.

Phone and desktop get equal design weight.

## Product Purpose

Tuklas, tagline "From Defense to Discovery", is a research and academic engagement hub. Student work leaves the defense room and becomes discoverable, credible public portfolios. Success means:
- advisers can approve work quickly
- students have a portfolio they're proud to share
- the feed holds only approved, academic content

## Positioning

Every public piece of student work has been signed off by a named adviser or the academic panel. The product makes that approval *visible and checkable*:
- **Verifiable sign-off seal:** each approved work carries a seal with a short code, anyone can check it at `/verify/:code`, and there's one-click APA/MLA citation.
- **Defense-to-Discovery journey:** an animated timeline of a work's path (submitted → adviser review → revisions → signed off → published), with the mascot Tuko marking milestones.

## Operating Context

- University setting: thesis defenses, adviser consultations, research colloquiums, School Innovation expos, the annual C.P. Garcia event.
- Build approach (from Oct 1 notes): incremental; the public-facing portfolio is a priority.
- Project target: first week of November 2026, with bi-weekly progress reviews.

## Capabilities and Constraints

- Roles: student / educator / admin. "Educator" is the role name; "Research adviser" is the adviser-facing term.
- Rules enforced on the server:
  - Student works stay private until an adviser or admin approves them.
  - Ads are limited to academic events (Research Colloquium, School Innovation, C.P. Garcia) and need admin approval.
  - Honors show as "Pending verification" until an admin verifies them.
- Content priority on profiles and the feed: research and literary works first, then Academic Background (diplomas and degrees), then Honors & Awards (awards, grants, certifications).
- Two appearance options were requested by the client: Modern, and Classic (early-to-mid-2000s LinkedIn). Plus dark mode.
- Stack: React + Vite + TypeScript with CSS Modules (no inline styles), Framer Motion, Lucide; Express + Zod + JWT; MySQL 8 + Prisma.

## Brand Commitments

- Name: **Tuklas** (Filipino for "discover"). Tagline: **"From Defense to Discovery"**.
- Logo: gold "T" badge. Brand panel in purple with a small gold badge (Oct 1 Figma).
- Palette (binding): purple #6C4AB6 (brand, primary buttons, focus), gold #FFCB57 (highlights, logo badge), blue #53C0E8 (secondary accent), lavender #ECE6FF (soft backgrounds, cards), off-white #F8F9FD (page background), ink #222221 (text, Admin accent). Role accents: Student purple, Educator blue, Admin ink.
- Inter is the base font (the user has asked for additional fonts to complement it).
- Mascot: **Tuko**, a gecko in a gold graduation cap, for empty states and success moments.
- Login: split layout, "Welcome back" card, "Continue as" Student / Educator / Admin, "Create your account".

## Evidence on Hand

- `../reference/prototype.html`: working prototype with all features, copy, and demo data.
- `../reference/August_31_2026.md` (and `.pdf`): client kickoff meeting and written Q&A, the source of the requirements.
- `../reference/October_1_2026.md` (and `.pdf`, `.docx`): design progress notes and palette decisions.
- Demo people (fictional): Andrea Villanueva, Paolo Reyes, Kim Dela Cruz, Dr. Maria Santos, Prof. Ramon Aquino, Lea Mercado.
- The institution is **generic and fictional** ("University of Iloilo" in demo data). Don't add real institution names, logos, statistics or testimonials.

## Product Principles

1. **Approval is the product.** Make sign-off visible, attributable and checkable, never decorative.
2. **The work leads.** Research and literary works outrank profile chrome, social signals and ads.
3. **Academic, not attention-economy.** No vanity metrics, no non-academic ads, no engagement bait.
4. **Celebrate milestones.** A student's progress from defense to discovery deserves a moment of delight, and Tuko provides it.
5. **Equal on every screen.** Every flow works as well on a phone as on a laptop.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast in every look and theme.
- 44px minimum touch targets, including the compact Classic look.
- All motion respects `prefers-reduced-motion`.
- Keyboard-operable drag-and-drop on the review board.
