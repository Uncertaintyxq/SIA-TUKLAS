/**
 * App — routes and the signed-in frame.
 * Public pages (portfolios, works, educator research) open without logging in;
 * everything else needs a session. The server enforces the same rules on every request.
 */
import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, NavLink, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import type { Role } from './types/auth';
import { useMe } from './api/auth';
import { AppShell } from './components/layout/AppShell';
import { Logo } from './components/brand/Logo';
import { Skeleton } from './components/ui/Skeleton';
import { EmptyState } from './components/ui/EmptyState';
import { ButtonLink } from './components/ui/Button';
import { RealtimeProvider } from './lib/realtime';
import { AccountGate } from './components/account/AccountGate';
import { LoginPage } from './pages/LoginPage';
import { AccountPage } from './pages/AccountPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AdminPage } from './pages/AdminPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { EventPage } from './pages/EventPage';
import { EventsPage } from './pages/EventsPage';
import { FeedPage } from './pages/FeedPage';
import { GroupPage } from './pages/GroupPage';
import { GroupsPage } from './pages/GroupsPage';
import { LibraryPage } from './pages/LibraryPage';
import { MessagesPage } from './pages/MessagesPage';
import { MyResearchPage } from './pages/MyResearchPage';
import { MyPortfolioPage, PublicPortfolioPage } from './pages/PortfolioPage';
import { PostOpportunityPage } from './pages/PostOpportunityPage';
import { PublicationEditorPage } from './pages/PublicationEditorPage';
import { PublicationPage } from './pages/PublicationPage';
import { ReviewPage } from './pages/ReviewPage';
import { WorkPage } from './pages/WorkPage';
import styles from './App.module.css';

function RequireAuth() {
  const { data: me, isPending, error } = useMe();
  const location = useLocation();
  if (isPending) return <ShellSkeleton />;
  if (error) return <Unavailable message={error.message} />;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return (
    <AccountGate me={me}>
      <AppShell user={me} />
    </AccountGate>
  );
}

/** Public pages (portfolios, works, educator research) sit in the app shell when signed in, and in a plain frame when not. */
function PublicOrShell() {
  const { data: me, isPending } = useMe();
  const location = useLocation();
  if (isPending) return <ShellSkeleton />;
  if (me) return <AppShell user={me} />;
  return (
    <div className={styles.public}>
      <header className={styles.publicHeader}>
        <NavLink to="/login" className={styles.publicBrand} aria-label="Tuklas">
          <Logo />
        </NavLink>
        <ButtonLink to="/login" state={{ from: location.pathname }} variant="primary">
          Log in
        </ButtonLink>
      </header>
      <main id="main" className={styles.publicMain}>
        <Outlet />
      </main>
    </div>
  );
}

/** Pages for some roles only. The server enforces the same rule on every request. */
function OnlyFor({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { data: me } = useMe();
  if (me && !roles.includes(me.role))
    return (
      <EmptyState title="This page isn’t for your role" action={<ButtonLink to="/feed" variant="primary">Back to the feed</ButtonLink>}>
        Your account doesn’t have access to it.
      </EmptyState>
    );
  return children;
}

function ShellSkeleton() {
  return (
    <div className={styles.loading} aria-busy="true" aria-label="Loading Tuklas">
      <Skeleton className={styles.lineWide} />
      <Skeleton className={styles.line} />
      <Skeleton className={styles.block} />
      <Skeleton className={styles.block} />
    </div>
  );
}

function Unavailable({ message }: { message: string }) {
  return (
    <main className={styles.center}>
      <EmptyState title="Tuklas can’t load right now" action={<ButtonLink to="/login" reloadDocument>Try again</ButtonLink>}>
        {message}
      </EmptyState>
    </main>
  );
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    // Public, no login needed
    element: <PublicOrShell />,
    children: [
      { path: '/u/:username', element: <PublicPortfolioPage /> },
      { path: '/works/:id', element: <WorkPage /> },
      { path: '/publications/:id', element: <PublicationPage /> },
      { path: '/privacy', element: <PrivacyPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: <Navigate to="/feed" replace /> },
      { path: '/feed', element: <FeedPage /> },
      { path: '/account', element: <AccountPage /> },
      // The gate shows the verify screen while the email is unconfirmed; after that, on to the feed.
      { path: '/verify-email', element: <Navigate to="/feed" replace /> },
      { path: '/announcements', element: <AnnouncementsPage /> },
      { path: '/messages', element: <OnlyFor roles={['student', 'educator']}><MessagesPage /></OnlyFor> },
      { path: '/messages/:id', element: <OnlyFor roles={['student', 'educator']}><MessagesPage /></OnlyFor> },
      { path: '/library', element: <LibraryPage /> },
      { path: '/publications/new', element: <OnlyFor roles={['educator']}><PublicationEditorPage /></OnlyFor> },
      { path: '/publications/:id/edit', element: <OnlyFor roles={['educator']}><PublicationEditorPage /></OnlyFor> },
      { path: '/portfolio', element: <MyPortfolioPage /> },
      { path: '/research', element: <MyResearchPage /> },
      { path: '/review', element: <OnlyFor roles={['educator', 'admin']}><ReviewPage /></OnlyFor> },
      { path: '/post', element: <OnlyFor roles={['educator', 'admin']}><PostOpportunityPage /></OnlyFor> },
      { path: '/events', element: <EventsPage /> },
      { path: '/events/:id', element: <EventPage /> },
      { path: '/groups', element: <GroupsPage /> },
      { path: '/groups/:id', element: <GroupPage /> },
      { path: '/admin', element: <OnlyFor roles={['admin']}><AdminPage /></OnlyFor> },
      { path: '*', element: <EmptyState title="This page isn’t in the notebook" action={<ButtonLink to="/feed" variant="primary">Back to the feed</ButtonLink>}>Check the address, or head back to the feed.</EmptyState> },
    ],
  },
]);

export function App() {
  const { data: me } = useMe();
  return (
    <RealtimeProvider userId={me?.id ?? null}>
      <RouterProvider router={router} />
    </RealtimeProvider>
  );
}
