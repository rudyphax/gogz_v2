import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { useMe } from './api/hooks';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { MembersPage } from './features/admin/MembersPage';
import { LoginPage } from './features/auth/LoginPage';
import { ChallengeDetailPage } from './features/golf/ChallengeDetailPage';
import { GolfPage } from './features/golf/GolfPage';
import { HomePage } from './features/home/HomePage';
import { GymPage } from './features/gym/GymPage';
import { NewPlanPage } from './features/gym/NewPlanPage';
import { SessionPage } from './features/gym/SessionPage';
import { ProfilePage } from './features/profile/ProfilePage';

// The chart library is large, so it only loads when someone opens Progress.
const ProgressPage = lazy(() =>
  import('./features/gym/ProgressPage').then((m) => ({ default: m.ProgressPage })),
);

function RequireAuth() {
  const { data: me, isPending } = useMe();
  const location = useLocation();
  if (isPending) return <Loading />;
  if (!me) {
    // Remember where they were headed (e.g. a challenge link from a text message).
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Layout me={me} />;
}

function AdminOnly() {
  const { data: me } = useMe();
  return me?.role === 'admin' ? <Outlet /> : <Navigate to="/golf" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route index element={<HomePage />} />
        <Route path="golf" element={<GolfPage />} />
        <Route path="golf/challenges/:id" element={<ChallengeDetailPage />} />
        <Route path="gym" element={<GymPage />} />
        <Route path="gym/plans/new" element={<NewPlanPage />} />
        <Route path="gym/sessions/:id" element={<SessionPage />} />
        <Route
          path="gym/progress"
          element={
            <Suspense fallback={<Loading />}>
              <ProgressPage />
            </Suspense>
          }
        />
        <Route path="profile" element={<ProfilePage />} />
        <Route element={<AdminOnly />}>
          <Route path="admin/members" element={<MembersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
