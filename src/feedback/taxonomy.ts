// src/feedback/taxonomy.ts
// SINGLE source of truth for the feedback taxonomy: how a bank entry's `type`
// tag derives into a longitudinal sentiment, the ordered grading-period list,
// and the derived tag-category names. send/, history/, and trends/ import from
// here so the mapping can be revised in ONE place and history re-derived under it.

/** The longitudinal sentiment a feedback item contributes to a student's trend. */
export type Sentiment = 'strength' | 'growth' | 'neutral';

/**
 * Canonical mapping from a bank entry `type` tag to its sentiment.
 * Keys are lowercased type tags. Extend here — never branch on type elsewhere.
 */
export const SENTIMENT_BY_TYPE: Readonly<Record<string, Sentiment>> = {
  success: 'strength',
  growth: 'growth',
  behavior: 'neutral',
  skill: 'neutral',
};

/**
 * Derive the sentiment for a bank-entry `type` tag. Unknown, empty, or missing
 * types fall back to 'neutral' so an untagged entry never crashes a trend roll-up.
 */
export function deriveSentiment(type: string | undefined | null): Sentiment {
  if (!type) return 'neutral';
  const key = type.trim().toLowerCase();
  return SENTIMENT_BY_TYPE[key] ?? 'neutral';
}

/**
 * Ordered grading periods for the pilot. The order is meaningful: history views
 * and trend timelines render in this sequence. EOY (end-of-year) sits last.
 */
export const GRADING_PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'S1', 'S2', 'EOY'] as const;
export type GradingPeriod = (typeof GRADING_PERIODS)[number];

/**
 * The derived tag categories stored on a FeedbackHistoryEntry. `sentiments` is
 * produced by deriveSentiment; `areas`/`standards` come from the bank entry tags.
 */
export const TAG_CATEGORIES = ['areas', 'sentiments', 'standards'] as const;
export type TagCategory = (typeof TAG_CATEGORIES)[number];
