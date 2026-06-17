import { Link } from 'react-router-dom';
import { signOutTeacher } from '../auth/authService';
import { tokens, tealButtonStyle } from '../ui/theme';

/**
 * App chrome shown on every signed-in page: the "Feedback" wordmark (links Home)
 * plus Home nav and a Sign out button. Routing-only — no data deps — so it
 * smoke-tests under a bare MemoryRouter. (Bank nav returns once BankPage + its
 * /bank route land.)
 */
export function NavBar() {
  const linkStyle = { color: tokens.color.subtle, fontWeight: 600, textDecoration: 'none' };
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.space(3),
        padding: `${tokens.space(1.5)}px ${tokens.space(3)}px`,
        background: tokens.color.panel,
        borderBottom: `1px solid ${tokens.color.border}`,
      }}
    >
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
      </nav>
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
