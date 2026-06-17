/**
 * The student's first name for use in messages — strips a trailing last-initial
 * the way teacher rosters list names ("Aneth G." → "Aneth", "Wednesday B" →
 * "Wednesday"). A lone name ("Ellie") and a full surname ("Lena Larson") are
 * left intact; only a final SINGLE-letter token (optionally with a period) is
 * treated as an initial and removed.
 */
export function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (trimmed === '') return '';
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return trimmed;
  const last = parts[parts.length - 1];
  // A trailing initial: one letter, optionally followed by a period.
  if (/^[A-Za-z]\.?$/.test(last)) {
    return parts.slice(0, -1).join(' ');
  }
  return trimmed;
}
