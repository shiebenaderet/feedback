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
    <main>
      <h1>Student Feedback Emails</h1>
      <p>
        Turn a class roster and a tagged bank of comment templates into
        personalized, reviewable, batch-sent emails to your students.
      </p>
      <button type="button" onClick={handleSignIn} disabled={busy}>
        Sign in with Google
      </button>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
