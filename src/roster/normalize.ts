// src/roster/normalize.ts

/** Collapse runs of whitespace and trim ends. */
function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize a name into "First [Middle] Last" order.
 * If the value contains exactly one comma, treat it as "Last, First ..." and flip it.
 * Otherwise return the whitespace-collapsed value unchanged.
 */
export function normalizeName(raw: string): string {
  const value = collapse(raw);
  const commaParts = value.split(',');
  if (commaParts.length === 2) {
    const last = collapse(commaParts[0]);
    const rest = collapse(commaParts[1]);
    if (last && rest) return `${rest} ${last}`;
    return last || rest;
  }
  return value;
}

/** Lowercase + trim an email; returns '' for whitespace-only input. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
