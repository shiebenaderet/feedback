import type { FeedbackHistoryEntry } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SUMMARY_MAX = 60;

/** "Oct 12" from an epoch-ms timestamp, in UTC for deterministic formatting. */
export function formatHistoryDate(sentAt: number): string {
  const d = new Date(sentAt);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Trim to a word boundary under the cap and append … only when truncated. */
function trimText(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= SUMMARY_MAX) return collapsed;
  const cut = collapsed.slice(0, SUMMARY_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * One-line dated summary for an entry, e.g. "Oct 12 · Q1 — Strong quarter, Ada…".
 * Uses the entry's explicit label when set, otherwise a trimmed finalText.
 */
export function summarizeHistoryEntry(entry: FeedbackHistoryEntry): string {
  const date = formatHistoryDate(entry.sentAt);
  const body = entry.label ? entry.label : trimText(entry.finalText);
  return `${date} · ${entry.gradingPeriod} — ${body}`;
}
