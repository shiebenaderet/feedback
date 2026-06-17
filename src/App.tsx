import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import { SetupPage } from './pages/SetupPage';
import { RosterPage } from './pages/RosterPage';
import { ComposePage } from './pages/ComposePage';
import { ReviewSendPage } from './pages/ReviewSendPage';
import RequireAuth from './auth/RequireAuth';

/** Route table, exported separately so tests can wrap it in a MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/home"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/setup"
        element={
          <RequireAuth>
            <SetupPage />
          </RequireAuth>
        }
      />
      <Route
        path="/course/:courseId/period/:periodId/roster"
        element={
          <RequireAuth>
            <RosterPage />
          </RequireAuth>
        }
      />
      {/* Phase 4 re-points ComposePage to the year/course/period tree. */}
      <Route
        path="/course/:courseId/period/:periodId/compose"
        element={
          <RequireAuth>
            <ComposePage />
          </RequireAuth>
        }
      />
      <Route
        path="/review/:batchId"
        element={
          <RequireAuth>
            <ReviewSendPage />
          </RequireAuth>
        }
      />
      {/* Unknown deep links fall through to the landing page. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
