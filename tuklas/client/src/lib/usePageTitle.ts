/**
 * usePageTitle — the browser tab's title for the screen on view ("Title · Tuklas").
 * resetTitleOnNavigate puts the default back whenever the address changes, so a screen without a
 * title of its own never keeps the previous screen's (or the one the server put in the page).
 */
import { useEffect } from 'react';
import type { createBrowserRouter } from 'react-router-dom';

const DEFAULT_TITLE = 'Tuklas — From Defense to Discovery';

export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} · Tuklas`;
  }, [title]);
}

/** Runs before the new screen renders, so its usePageTitle wins. */
export function resetTitleOnNavigate(router: ReturnType<typeof createBrowserRouter>) {
  let path = router.state.location.pathname;
  router.subscribe((state) => {
    if (state.location.pathname === path) return;
    path = state.location.pathname;
    document.title = DEFAULT_TITLE;
  });
}
