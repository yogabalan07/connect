import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import {
  RequireAdmin,
  RequireAuth,
  RequireForbidden,
  RequireGuest,
  StatusGate
} from './components/routing/RouteGuard';

// Layouts (eager: they are the shell every page mounts inside)
import { AppLayout } from './components/layout/AppLayout';
import { AdminLayout } from './components/layout/AdminLayout';

// Toasts (global: auth + app actions both emit them)
import { ToastContainer } from './components/ui/ToastContainer';

/**
 * Route-level code splitting.
 *
 * Every page is its own chunk so the first paint of `/` or `/login` does not
 * drag the admin console, the analytics charts and the message thread along
 * with it - the previous single 1.35 MB bundle made the landing page pay for
 * routes most visitors never open. Layouts and guards stay eager because
 * they are the shell.
 *
 * Pages export their component by name rather than as a default, so the
 * loader resolves it explicitly and fails loudly if an export is renamed.
 */
type PageModule = Record<string, React.ComponentType | undefined>;

function lazyPage(loader: () => Promise<unknown>, name: string) {
  return lazy(() =>
    loader().then(mod => {
      const Component = (mod as PageModule)[name];
      if (!Component) {
        throw new Error(`Route component "${name}" is not exported by its module.`);
      }
      return { default: Component };
    })
  );
}

// Public & Auth Pages
const LandingPage = lazyPage(() => import('./pages/landing/LandingPage'), 'LandingPage');
const LoginPage = lazyPage(() => import('./pages/auth/LoginPage'), 'LoginPage');
const RegisterPage = lazyPage(() => import('./pages/auth/RegisterPage'), 'RegisterPage');
const ForgotPasswordPage = lazyPage(
  () => import('./pages/auth/ForgotPasswordPage'),
  'ForgotPasswordPage'
);
const PendingApprovalPage = lazyPage(
  () => import('./pages/auth/PendingApprovalPage'),
  'PendingApprovalPage'
);

// Student / User App Pages
const DashboardPage = lazyPage(() => import('./pages/dashboard/DashboardPage'), 'DashboardPage');
const ExplorePage = lazyPage(() => import('./pages/doubts/ExplorePage'), 'ExplorePage');
const DoubtDetailPage = lazyPage(() => import('./pages/doubts/DoubtDetailPage'), 'DoubtDetailPage');
const CreateDoubtPage = lazyPage(() => import('./pages/doubts/CreateDoubtPage'), 'CreateDoubtPage');
const MyDoubtsPage = lazyPage(() => import('./pages/doubts/MyDoubtsPage'), 'MyDoubtsPage');
const BookmarksPage = lazyPage(() => import('./pages/doubts/BookmarksPage'), 'BookmarksPage');
const CategoriesPage = lazyPage(
  () => import('./pages/community/CategoriesPage'),
  'CategoriesPage'
);
const TagsPage = lazyPage(() => import('./pages/community/TagsPage'), 'TagsPage');
const CommunityPage = lazyPage(() => import('./pages/community/CommunityPage'), 'CommunityPage');
const ReputationPage = lazyPage(
  () => import('./pages/community/ReputationPage'),
  'ReputationPage'
);
const UserProfilePage = lazyPage(
  () => import('./pages/users/UserProfilePage'),
  'UserProfilePage'
);
const FollowersPage = lazyPage(() => import('./pages/users/FollowersPage'), 'FollowersPage');
const FollowingPage = lazyPage(() => import('./pages/users/FollowingPage'), 'FollowingPage');
const MessagesPage = lazyPage(() => import('./pages/messages/MessagesPage'), 'MessagesPage');
const NotificationsPage = lazyPage(
  () => import('./pages/notifications/NotificationsPage'),
  'NotificationsPage'
);
const SettingsPage = lazyPage(() => import('./pages/settings/SettingsPage'), 'SettingsPage');

// Admin Pages
const AdminDashboardPage = lazyPage(
  () => import('./pages/admin/AdminDashboardPage'),
  'AdminDashboardPage'
);
const AdminUsersPage = lazyPage(() => import('./pages/admin/AdminUsersPage'), 'AdminUsersPage');
const AdminPendingUsersPage = lazyPage(
  () => import('./pages/admin/AdminPendingUsersPage'),
  'AdminPendingUsersPage'
);
const AdminDoubtsPage = lazyPage(() => import('./pages/admin/AdminDoubtsPage'), 'AdminDoubtsPage');
const AdminReportsPage = lazyPage(
  () => import('./pages/admin/AdminReportsPage'),
  'AdminReportsPage'
);
const AdminCategoriesPage = lazyPage(
  () => import('./pages/admin/AdminCategoriesPage'),
  'AdminCategoriesPage'
);
const AdminAnnouncementsPage = lazyPage(
  () => import('./pages/admin/AdminAnnouncementsPage'),
  'AdminAnnouncementsPage'
);
const AdminAnalyticsPage = lazyPage(
  () => import('./pages/admin/AdminAnalyticsPage'),
  'AdminAnalyticsPage'
);
const AdminAuditLogsPage = lazyPage(
  () => import('./pages/admin/AdminAuditLogsPage'),
  'AdminAuditLogsPage'
);
const AdminSettingsPage = lazyPage(
  () => import('./pages/admin/AdminSettingsPage'),
  'AdminSettingsPage'
);

// Error & Status Pages
const NotFoundPage = lazyPage(() => import('./pages/errors/NotFoundPage'), 'NotFoundPage');
const ForbiddenPage = lazyPage(() => import('./pages/errors/ForbiddenPage'), 'ForbiddenPage');
const BlockedAccountPage = lazyPage(
  () => import('./pages/errors/BlockedAccountPage'),
  'BlockedAccountPage'
);
const RejectedAccountPage = lazyPage(
  () => import('./pages/errors/RejectedAccountPage'),
  'RejectedAccountPage'
);

/** Shown while a route chunk is being fetched. */
function RouteFallback() {
  return (
    <div
      className="min-h-[60vh] flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="flex flex-col items-center gap-3 text-slate-400 text-xs">
        <span className="w-6 h-6 rounded-full border-2 border-slate-700 border-t-indigo-400 animate-spin" />
        <span>Loading…</span>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      {/* Auth first: AppContext derives currentUser from the auth session. */}
      <AuthProvider>
        <AppProvider>
          <MotionConfig reducedMotion="user">
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Public */}
                <Route path="/" element={<LandingPage />} />

                {/* Guest-only auth screens */}
                <Route
                  path="/login"
                  element={
                    <RequireGuest>
                      <LoginPage />
                    </RequireGuest>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <RequireGuest>
                      <RegisterPage />
                    </RequireGuest>
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <RequireGuest>
                      <ForgotPasswordPage />
                    </RequireGuest>
                  }
                />

                {/* Account status screens */}
                <Route
                  path="/pending-approval"
                  element={
                    <StatusGate status="pending">
                      <PendingApprovalPage />
                    </StatusGate>
                  }
                />
                <Route
                  path="/rejected"
                  element={
                    <StatusGate status="rejected">
                      <RejectedAccountPage />
                    </StatusGate>
                  }
                />
                <Route
                  path="/blocked"
                  element={
                    <StatusGate status="blocked">
                      <BlockedAccountPage />
                    </StatusGate>
                  }
                />
                <Route
                  path="/forbidden"
                  element={
                    <RequireForbidden>
                      <ForbiddenPage />
                    </RequireForbidden>
                  }
                />

                {/* Student Application (active users only) */}
                <Route
                  path="/app"
                  element={
                    <RequireAuth>
                      <AppLayout />
                    </RequireAuth>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="explore" element={<ExplorePage />} />
                  <Route path="doubts/:id" element={<DoubtDetailPage />} />
                  <Route path="doubts/:id/edit" element={<CreateDoubtPage />} />
                  <Route path="create" element={<CreateDoubtPage />} />
                  <Route path="my-doubts" element={<MyDoubtsPage />} />
                  <Route path="bookmarks" element={<BookmarksPage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="tags" element={<TagsPage />} />
                  <Route path="community" element={<CommunityPage />} />
                  <Route path="reputation" element={<ReputationPage />} />
                  <Route path="users/:id" element={<UserProfilePage />} />
                  <Route path="users/:id/followers" element={<FollowersPage />} />
                  <Route path="users/:id/following" element={<FollowingPage />} />
                  <Route path="followers" element={<FollowersPage />} />
                  <Route path="following" element={<FollowingPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="messages" element={<MessagesPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                {/* Admin Control Center (active admins only) */}
                <Route
                  path="/admin"
                  element={
                    <RequireAdmin>
                      <AdminLayout />
                    </RequireAdmin>
                  }
                >
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="users/pending" element={<AdminPendingUsersPage />} />
                  <Route path="doubts" element={<AdminDoubtsPage />} />
                  <Route path="reports" element={<AdminReportsPage />} />
                  <Route path="categories" element={<AdminCategoriesPage />} />
                  <Route path="announcements" element={<AdminAnnouncementsPage />} />
                  <Route path="analytics" element={<AdminAnalyticsPage />} />
                  <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                  <Route path="settings" element={<AdminSettingsPage />} />
                </Route>

                {/* 404 Catch All */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>

            {/* Global toasts: available on auth screens, status screens and the app. */}
            <ToastContainer />
          </MotionConfig>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
