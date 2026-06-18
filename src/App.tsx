import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth';

// Route-level code splitting: each page becomes its own chunk so the initial
// load only pulls what the current route needs. Named-export pages are mapped
// to a default export, which is what React.lazy expects.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const SetupPage = lazy(() =>
  import('./pages/SetupPage').then((m) => ({ default: m.SetupPage })),
);
const RosterPage = lazy(() =>
  import('./pages/RosterPage').then((m) => ({ default: m.RosterPage })),
);
const ComposePage = lazy(() =>
  import('./pages/ComposePage').then((m) => ({ default: m.ComposePage })),
);
const ReviewSendPage = lazy(() =>
  import('./pages/ReviewSendPage').then((m) => ({ default: m.ReviewSendPage })),
);
const BankPage = lazy(() =>
  import('./pages/BankPage').then((m) => ({ default: m.BankPage })),
);
const StudentHistoryPage = lazy(() =>
  import('./pages/StudentHistoryPage').then((m) => ({
    default: m.StudentHistoryPage,
  })),
);
const TrendsPage = lazy(() =>
  import('./pages/TrendsPage').then((m) => ({ default: m.TrendsPage })),
);

/** Lightweight fallback shown while a lazily-loaded route chunk is fetched. */
function RouteFallback() {
  return (
    <p
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        color: 'var(--muted)',
      }}
    >
      Loading…
    </p>
  );
}

/** Route table, exported separately so tests can wrap it in a MemoryRouter. */
export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
        <Route
          path="/bank"
          element={
            <RequireAuth>
              <BankPage />
            </RequireAuth>
          }
        />
        <Route
          path="/student/:studentId/history"
          element={
            <RequireAuth>
              <StudentHistoryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/course/:courseId/period/:periodId/trends"
          element={
            <RequireAuth>
              <TrendsPage scope="period" />
            </RequireAuth>
          }
        />
        <Route
          path="/course/:courseId/trends"
          element={
            <RequireAuth>
              <TrendsPage scope="course" />
            </RequireAuth>
          }
        />
        {/* Unknown deep links fall through to the landing page. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return <AppRoutes />;
}
