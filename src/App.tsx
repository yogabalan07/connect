import React from 'react';
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

// Layouts
import { AppLayout } from './components/layout/AppLayout';
import { AdminLayout } from './components/layout/AdminLayout';

// Toasts (global: auth + app actions both emit them)
import { ToastContainer } from './components/ui/ToastContainer';

// Public & Auth Pages
import { LandingPage } from './pages/landing/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { PendingApprovalPage } from './pages/auth/PendingApprovalPage';

// Student / User App Pages
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { ExplorePage } from './pages/doubts/ExplorePage';
import { DoubtDetailPage } from './pages/doubts/DoubtDetailPage';
import { CreateDoubtPage } from './pages/doubts/CreateDoubtPage';
import { MyDoubtsPage } from './pages/doubts/MyDoubtsPage';
import { BookmarksPage } from './pages/doubts/BookmarksPage';
import { CategoriesPage } from './pages/community/CategoriesPage';
import { TagsPage } from './pages/community/TagsPage';
import { CommunityPage } from './pages/community/CommunityPage';
import { ReputationPage } from './pages/community/ReputationPage';
import { UserProfilePage } from './pages/users/UserProfilePage';
import { FollowersPage } from './pages/users/FollowersPage';
import { FollowingPage } from './pages/users/FollowingPage';
import { MessagesPage } from './pages/messages/MessagesPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { SettingsPage } from './pages/settings/SettingsPage';

// Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminPendingUsersPage } from './pages/admin/AdminPendingUsersPage';
import { AdminDoubtsPage } from './pages/admin/AdminDoubtsPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminAnnouncementsPage } from './pages/admin/AdminAnnouncementsPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminAuditLogsPage } from './pages/admin/AdminAuditLogsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

// Error & Status Pages
import { NotFoundPage } from './pages/errors/NotFoundPage';
import { ForbiddenPage } from './pages/errors/ForbiddenPage';
import { BlockedAccountPage } from './pages/errors/BlockedAccountPage';
import { RejectedAccountPage } from './pages/errors/RejectedAccountPage';

export function App() {
  return (
    <BrowserRouter>
      {/* Auth first: AppContext derives currentUser from the auth session. */}
      <AuthProvider>
        <AppProvider>
          <MotionConfig reducedMotion="user">
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

            {/* Global toasts: available on auth screens, status screens and the app. */}
            <ToastContainer />
          </MotionConfig>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
