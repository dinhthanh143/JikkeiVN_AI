/* eslint-disable react-refresh/only-export-components */

import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import AuthInitializer from '@/components/layout/AuthInitializer'
import HomePage from '@/pages/HomePage'
import { useAuth } from '@/hooks/useAuth'
import { HomePanel } from '@/components/panels/HomePanel'
import { PlayPanel } from '@/components/panels/PlayPanel'
import { PublicStoriesPanel } from '@/components/panels/PublicStoriesPanel'
import { CommunityPanel } from '@/components/panels/CommunityPanel'
import { SettingsPanel } from '@/components/panels/SettingsPanel'
import AdminOverviewPanel from '@/components/panels/AdminOverviewPanel'
import AdminUsersPanel from '@/components/panels/AdminUsersPanel'
import AdminActivityPanel from '@/components/panels/AdminActivityPanel'
import AdminScenesPanel from '@/components/panels/AdminScenesPanel'
import AdminReportsPanel from '@/components/panels/AdminReportsPanel'
import AdminRolesPanel from '@/components/panels/AdminRolesPanel'
import AdminSystemPanel from '@/components/panels/AdminSystemPanel'
import NotFoundPage from '@/pages/NotFoundPage'
import { AppLoadingScreen } from '@/components/ui/AppLoadingScreen'

const ExplorePage = lazy(() => import('@/pages/ExplorePage'))
const StoryPage = lazy(() => import('@/pages/StoryPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const UserStoriesPage = lazy(() => import('@/pages/UserStoriesPage'))
const SceneCreatorPage = lazy(() => import('@/pages/SceneCreatorPage'))
const AuthPage = lazy(() => import('@/pages/AuthPage'))
const CompleteRegistrationPage = lazy(() => import('@/pages/CompleteRegistrationPage'))
const TermsPage = lazy(() => import('@/pages/TermsPage'))
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'))
const HubPage = lazy(() => import('@/pages/HubPage'))
const MarketplacePage = lazy(() => import('@/pages/MarketplacePage'))

// NOTE: this used to be a locally-defined component with its own
// width:100%/height:100vh box (no position:fixed). Mounted inside the
// sidebar layout's padded `.panel-scroll` container (every one of these
// Suspense boundaries lives under HomePage's <Outlet />), that box got
// boxed in by the container's padding — a band of blank background showing
// around the loader instead of a true fullscreen cover. AppLoadingScreen
// fixes that (position: fixed; inset: 0) and is now also the ONLY loader
// shown during a route transition like Play → Edit story, since
// SceneCreatorPage's own data-loading gate uses it too instead of a second,
// different-looking loading screen.
function SuspenseFallback() {
  return <AppLoadingScreen kicker="JIKKEI" copy="Loading..." />
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, authResolved, role } = useAuth()
  if (!authResolved) return <SuspenseFallback />
  if (!isAuthenticated) return <Navigate to="/auth" replace />
  if (role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    element: <AuthInitializer />,
    children: [
      {
        path: '/',
        element: <HomePage />,
        children: [
          { index: true, element: <HomePanel /> },
          { path: 'play', element: <PlayPanel /> },
          { path: 'public_stories', element: <PublicStoriesPanel /> },
          {
            path: 'hub',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <HubPage />
              </Suspense>
            ),
          },
          {
            path: 'marketplace',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <MarketplacePage />
              </Suspense>
            ),
          },
          {
            path: 'create',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <SceneCreatorPage />
              </Suspense>
            ),
          },
          // ── Edit route lives here so it gets the HomePage sidebar ──
          {
            path: 'story/:storyId/edit',
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <SceneCreatorPage />
              </Suspense>
            ),
          },
          { path: 'community', element: <CommunityPanel /> },
          { path: 'settings', element: <SettingsPanel /> },
          { path: 'admin', element: <Navigate to="/admin/overview" replace /> },
          { path: 'admin/overview', element: <RequireAdmin><AdminOverviewPanel /></RequireAdmin> },
          { path: 'admin/users', element: <RequireAdmin><AdminUsersPanel /></RequireAdmin> },
          { path: 'admin/activity', element: <RequireAdmin><AdminActivityPanel /></RequireAdmin> },
          { path: 'admin/scenes', element: <RequireAdmin><AdminScenesPanel /></RequireAdmin> },
          { path: 'admin/reports', element: <RequireAdmin><AdminReportsPanel /></RequireAdmin> },
          { path: 'admin/roles', element: <RequireAdmin><AdminRolesPanel /></RequireAdmin> },
          { path: 'admin/system', element: <RequireAdmin><AdminSystemPanel /></RequireAdmin> },
          { path: 'options', element: <Navigate to="/settings" replace /> },
          {
            path: 'auth',
            element: <Suspense fallback={<SuspenseFallback />}><AuthPage /></Suspense>,
          },
          {
            path: 'auth/complete-registration',
            element: <Suspense fallback={<SuspenseFallback />}><CompleteRegistrationPage /></Suspense>,
          },
          {
            path: 'explore',
            element: <Suspense fallback={<SuspenseFallback />}><ExplorePage /></Suspense>,
          },
          {
            path: 'profile/:username',
            element: <Suspense fallback={<SuspenseFallback />}><ProfilePage /></Suspense>,
          },
          {
            path: 'profile/:username/stories',
            element: <Suspense fallback={<SuspenseFallback />}><UserStoriesPage /></Suspense>,
          },
        ],
      },
      // ── Story play page (fullscreen, no sidebar) ───────────────────
      {
        path: '/story/:storyId',
        element: <Suspense fallback={<SuspenseFallback />}><StoryPage /></Suspense>,
      },
      {
        path: '/terms',
        element: <Suspense fallback={<SuspenseFallback />}><TermsPage /></Suspense>,
      },
      {
        path: '/privacy',
        element: <Suspense fallback={<SuspenseFallback />}><PrivacyPage /></Suspense>,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
