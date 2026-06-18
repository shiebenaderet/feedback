import { Link } from 'react-router-dom';
import { signOutTeacher } from '../auth/authService';
import { tokens, tealButtonStyle, navBarStyle } from '../ui/theme';
import { useTheme } from '../ui/useTheme';

/**
 * App chrome shown on every signed-in page: the "Feedback" wordmark (links Home)
 * plus Home / Bank nav and a Sign out button. Routing-only — no data deps — so it
 * smoke-tests under a bare MemoryRouter.
 */
export function NavBar() {
  const linkStyle = { color: tokens.color.subtle, fontWeight: 600, textDecoration: 'none' };
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <header style={navBarStyle()}>
      <Link
        to="/home"
        style={{ ...linkStyle, color: tokens.color.teal, fontSize: 18, letterSpacing: '-0.01em' }}
      >
        Feedback
      </Link>
      <nav style={{ display: 'flex', gap: tokens.space(2), flex: 1 }}>
        <Link to="/home" style={linkStyle}>
          Home
        </Link>
        <Link to="/bank" style={linkStyle}>
          Bank
        </Link>
      </nav>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        style={{
          background: 'transparent',
          color: tokens.color.subtle,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.md,
          padding: '6px 10px',
          fontSize: 14,
          lineHeight: 1,
          cursor: 'pointer',
        }}
      >
        {isDark ? '☀' : '☾'}
      </button>
      <button
        type="button"
        onClick={() => void signOutTeacher()}
        style={{ ...tealButtonStyle(), padding: '6px 14px' }}
      >
        Sign out
      </button>
    </header>
  );
}
