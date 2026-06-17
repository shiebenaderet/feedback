import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { __setGmailAccessToken } from './gmailToken';

// Scope that lets the app send mail as the teacher (Send Flow, Mode A).
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

/**
 * Open the Google sign-in popup, requesting the Gmail-send scope in the same
 * step as login. Captures the Gmail OAuth access token (only available on the
 * credential at sign-in) and resolves with the signed-in user.
 */
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.addScope(GMAIL_SEND_SCOPE);
  // Always show the account chooser so the right Workspace account is used.
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  __setGmailAccessToken(credential?.accessToken ?? null);
  return result.user;
}

/** Sign the teacher out. */
export async function signOutTeacher(): Promise<void> {
  __setGmailAccessToken(null);
  await signOut(auth);
}
