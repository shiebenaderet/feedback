import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase/config';

// Scope that lets the app send mail as the teacher (Send Flow, Mode A).
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

/**
 * Open the Google sign-in popup, requesting the Gmail-send scope in the same
 * step as login. Resolves with the signed-in user.
 */
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.addScope(GMAIL_SEND_SCOPE);
  // Always show the account chooser so the right Workspace account is used.
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  return result.user;
}

/** Sign the teacher out. */
export async function signOutTeacher(): Promise<void> {
  await signOut(auth);
}
