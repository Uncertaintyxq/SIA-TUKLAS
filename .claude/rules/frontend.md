---
paths:
  - "tuklas/client/**/*"
---

# Front-end rules (tuklas/client, React + Vite + TypeScript)

- API calls only through hooks in `src/api/<module>.ts` using `api()` / `upload()` from
  `src/api/client.ts` (it adds the CSRF header and turns errors into `ApiError`). Writes use `useAction()`.
- API types live in `src/types/<module>.ts` and match the server's JSON exactly.
- Styling: CSS Modules with tokens from `src/styles/tokens.css`. No inline `style` (ESLint enforces it).
  No Prettier: don't reformat code you aren't changing.
- Reuse `src/components/ui/` and `components/layout/` (hot: change them in small, separate steps).
- What someone may do comes from the server (`can.*` flags), not from role checks in the client.
- Accessibility: every input has a label, icon-only buttons have `sr-only` text, errors use
  `role="alert"`, buttons are `<button>`.
- Avoid `window.confirm` in new code where a simple inline confirmation works: browser dialogs
  block automated browser checks.
- Before calling UI work done: `npm run typecheck`, `npm run lint`, `npm run build`, and a browser
  check (ask the developer first; see `docs/GETTING_STARTED.md`).
