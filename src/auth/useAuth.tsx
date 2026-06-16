import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '../firebase/config';
import { parseAllowlist, isEmailAllowed } from './allowlist';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthState {
  status: AuthStatus;
  user: User | null;
}

const AuthContext = createContext<AuthState>({
  status: 'loading',
  user: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
  });

  useEffect(() => {
    const allowlist = parseAllowlist(import.meta.env.VITE_TEACHER_ALLOWLIST);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setState({ status: 'signedOut', user: null });
        return;
      }
      // Enforce the allowlist client-side; Firestore rules are the real gate.
      if (isEmailAllowed(user.email, allowlist)) {
        setState({ status: 'signedIn', user });
      } else {
        // Not the teacher: drop the session and treat as signed out.
        void signOut(auth);
        setState({ status: 'signedOut', user: null });
      }
    });

    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
