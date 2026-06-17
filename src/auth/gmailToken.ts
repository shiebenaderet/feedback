// Gmail OAuth access token, captured at sign-in (Firebase's User does not expose
// it). Persisted to sessionStorage so it survives a page reload / deep-link within
// the same browser session — without it, a refreshed session would silently lose
// the token and degrade to copy-paste (Mode B). sessionStorage (not localStorage)
// is deliberate: the ~1h OAuth token should not outlive the tab.
const STORAGE_KEY = 'gmailAccessToken';

function readStore(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // sessionStorage unavailable (SSR / privacy mode) — fall back to memory only.
    return null;
  }
}

let memoryToken: string | null = readStore();

export function getGmailAccessToken(): string | null {
  // Prefer the live store (survives reload); fall back to the in-memory copy.
  const stored = readStore();
  return stored ?? memoryToken;
}

/** Internal setter — used by authService at sign-in/out and by tests. */
export function __setGmailAccessToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token === null) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // ignore storage failures; memory copy still works for this session
  }
}
