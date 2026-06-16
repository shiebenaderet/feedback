import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import { RosterPage } from './pages/RosterPage';
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
        path="/roster"
        element={
          <RequireAuth>
            <RosterPage />
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
