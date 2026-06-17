import type { FeedbackHistoryEntry } from '../types';

export interface FeedbackProgress {
  done: number;
  total: number;
}

/**
 * Pure progress reducer for a single period card on the Home screen.
 *
 * Given a period's roster size and the FeedbackHistoryEntry[] written under that
 * period, returns how many DISTINCT students already have feedback for
 * `gradingPeriod` (e.g. 'Q1'). The grading-period value is supplied by the caller
 * from GRADING_PERIODS in src/feedback/taxonomy.ts — this helper never hardcodes
 * the list. `done` is clamped to `total` so re-sends or since-removed students
 * never push the bar past 100%.
 */
export function periodFeedbackProgress(
  rosterSize: number,
  history: FeedbackHistoryEntry[],
  gradingPeriod: string,
): FeedbackProgress {
  const distinct = new Set(
    history
      .filter((h) => h.gradingPeriod === gradingPeriod)
      .map((h) => h.studentId),
  );
  return { done: Math.min(distinct.size, rosterSize), total: rosterSize };
}
