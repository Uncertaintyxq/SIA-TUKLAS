/**
 * Client entry — mounts the app with its query cache, preferences, motion and toast providers.
 * Also loads the fonts and global styles once for every page.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import '@fontsource-variable/inter';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/martian-mono';
import './styles/tokens.css';
import './styles/global.css';
import { PrefsProvider } from './lib/prefs';
import { ToastProvider } from './components/ui/Toast';
import { App } from './App';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PrefsProvider>
        {/* Honors the OS reduced-motion setting for every Framer Motion animation */}
        <MotionConfig reducedMotion="user">
          <ToastProvider>
            <App />
          </ToastProvider>
        </MotionConfig>
      </PrefsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
