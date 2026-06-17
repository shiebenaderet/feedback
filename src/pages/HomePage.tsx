import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { signOutTeacher } from '../auth/authService';
import { tokens, panelStyle, tealButtonStyle } from '../ui/theme';

export default function HomePage() {
  const { user } = useAuth();
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: tokens.space(4) }}>
      <h1 style={{ fontSize: 28, letterSpacing: '-0.01em' }}>
        Student Feedback Emails
      </h1>
      <p style={{ color: tokens.color.muted }}>Signed in as {user?.email}</p>
      <nav style={{ ...panelStyle(), marginTop: tokens.space(2), display: 'flex', gap: tokens.space(2) }}>
        <Link to="/roster" style={{ color: tokens.color.teal, fontWeight: 600 }}>
          Manage roster →
        </Link>
      </nav>
      <button
        type="button"
        onClick={() => void signOutTeacher()}
        style={{ ...tealButtonStyle(), marginTop: tokens.space(3) }}
      >
        Sign out
      </button>
    </main>
  );
}
