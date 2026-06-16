// src/send/isAuthError.ts

/**
 * Pure classifier: is this thrown value an AUTH failure (expired/invalid Gmail
 * token / missing scope), as opposed to a per-message send failure?
 *
 * Auth failures are batch-wide: the runner must STOP and re-authorize, not mark
 * a single message `failed`. Anything we cannot positively identify as auth is
 * treated as a per-message failure (safer: it gets retried per-message, not by
 * forcing a re-login).
 */
export function isAuthError(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;

  // Normalize the various shapes Gmail/gapi/fetch throw.
  const e = err as Record<string, any>;
  const status: unknown = e.status ?? e.error?.code ?? e.result?.error?.code;
  const statusText: string = String(
    e.result?.error?.status ?? e.error?.status ?? '',
  ).toUpperCase();
  const message: string = String(
    e.message ?? e.error?.message ?? e.result?.error?.message ?? '',
  ).toLowerCase();

  if (status === 401) return true;
  if (statusText === 'UNAUTHENTICATED') return true;

  // Token-expiry signals that may ride on a non-401 status.
  return (
    message.includes('invalid_grant') ||
    message.includes('invalid credentials') ||
    message.includes('invalid_credentials') ||
    message.includes('invalid_token') ||
    message.includes('token expired') ||
    message.includes('token has expired')
  );
}
