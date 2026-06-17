import type { BankEntry, FeedbackHistoryEntry } from '../types';
import { deriveSentiment } from './taxonomy';

/** The derived, structured tag bundle stored on a feedbackHistory entry. */
export type DerivedTags = FeedbackHistoryEntry['tags'];

/** Push value(s) onto acc if not already present (order-stable dedupe). */
function pushUnique(acc: string[], value: unknown): void {
  if (value == null || value === '') return;
  if (Array.isArray(value)) {
    for (const v of value) pushUnique(acc, v);
    return;
  }
  const s = String(value);
  if (!acc.includes(s)) acc.push(s);
}

/**
 * Derive the structured history tags from the bank entries used in a message.
 *
 * - areas: each entry's tags.area, deduped, in first-seen order.
 * - sentiments: deriveSentiment(entry.tags.type) per the taxonomy
 *   (success→strength, growth→growth, behavior/skill→neutral), deduped.
 * - standards: a future 'standard' tag (string or string[]); empty today since
 *   seed entries carry no standard.
 *
 * Pure and synchronous — the raw usedEntries are stored alongside the result so
 * trends can be re-derived under a new taxonomy at any time.
 */
export function deriveHistoryTags(entries: BankEntry[]): DerivedTags {
  const areas: string[] = [];
  const sentiments: string[] = [];
  const standards: string[] = [];

  for (const e of entries) {
    pushUnique(areas, e.tags.area);

    const sentiment = e.tags.type ? deriveSentiment(e.tags.type) : undefined;
    pushUnique(sentiments, sentiment);

    // Future 'standard' tag — not yet in BankTags, read defensively.
    pushUnique(standards, (e.tags as { standard?: string | string[] }).standard);
  }

  return {
    areas,
    sentiments: sentiments as DerivedTags['sentiments'],
    standards,
  };
}
