import { useAuth } from '../auth/useAuth';
import { signOutTeacher } from '../auth/authService';

export default function HomePage() {
  const { user } = useAuth();
  return (
    <main>
      <h1>Student Feedback Emails</h1>
      <p>Signed in as {user?.email}</p>
      <button type="button" onClick={() => void signOutTeacher()}>
        Sign out
      </button>
    </main>
  );
}
