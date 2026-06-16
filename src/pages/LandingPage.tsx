import { useState } from 'react';
import { signInWithGoogle } from '../auth/authService';

export default function LandingPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      // On success, useAuth's onAuthStateChanged drives the route change.
    } catch {
      setError('Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0d0d0f',
        color: '#e7e9ee',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 12px' }}>
          Student Feedback Emails
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: '#b8bcc6', margin: '0 0 28px' }}>
          Write personalized end-of-year notes to every student — fast. Pull from your own
          bank of comment templates, fill in the details that make each one personal, review
          the whole class, then send.
        </p>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 0 32px',
            display: 'grid',
            gap: 10,
            textAlign: 'left',
            color: '#cbd0d9',
            fontSize: 15,
          }}
        >
          <li>📋 Import your roster from a CSV — names auto-fill into every message.</li>
          <li>💬 Build messages from a tagged bank of comments and stories.</li>
          <li>✉️ Review each student, then batch-send (or copy-paste).</li>
          <li>🔒 Your students' data stays private to you.</li>
        </ul>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          style={{
            background: busy ? '#2a2e37' : '#5fb8a8',
            color: busy ? '#9aa1ad' : '#0d1311',
            border: 'none',
            borderRadius: 10,
            padding: '12px 22px',
            fontSize: 16,
            fontWeight: 600,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? 'Signing in…' : 'Sign in with Google'}
        </button>

        {error && (
          <p role="alert" style={{ color: '#ff8a8a', marginTop: 16 }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
