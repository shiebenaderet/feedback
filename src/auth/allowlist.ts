/**
 * Parse the comma-separated VITE_TEACHER_ALLOWLIST env string into a
 * normalized (trimmed, lowercased, non-empty) list of allowed emails.
 */
export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

/**
 * True only if `email` exactly matches an entry in `allowlist`
 * (case-insensitive). Empty allowlist allows no one.
 */
export function isEmailAllowed(
  email: string | null | undefined,
  allowlist: string[],
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return allowlist.includes(normalized);
}
