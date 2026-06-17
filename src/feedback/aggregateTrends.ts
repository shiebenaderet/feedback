import type { BankEntry, FeedbackHistoryEntry } from '../types';
import { deriveSentiment, type Sentiment } from './taxonomy';

export type CountMap = Record<string, number>;

export interface TrendsSummary {
  total: number;
  byArea: CountMap;
  bySentiment: CountMap;
  byGradingPeriod: CountMap;
  byStandard: CountMap;
  /** Just the two directional buckets, for a strength/growth balance bar. */
  strengthGrowthBalance: { strength: number; growth: number };
  /** Growth-sentiment entries' areas, most frequent first. */
  topGrowthAreas: Array<{ area: string; count: number }>;
}

function bump(map: CountMap, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

/**
 * Pure trends aggregation over feedbackHistory entries.
 *
 * Sentiment is RE-DERIVED from each entry's raw `usedEntries` (bank ids) through
 * the taxonomy's type→sentiment map (deriveSentiment), so the analytics survive
 * a future mapping change without rewriting stored data. Stored `tags.sentiments`
 * is used only as a fallback for entries whose bank id is no longer resolvable.
 */
export function aggregateTrends(
  entries: FeedbackHistoryEntry[],
  bank: BankEntry[],
): TrendsSummary {
  const typeById = new Map(bank.map((b) => [b.id, b.tags.type]));

  const byArea: CountMap = {};
  const bySentiment: CountMap = {};
  const byGradingPeriod: CountMap = {};
  const byStandard: CountMap = {};
  const growthAreaCounts: CountMap = {};

  for (const e of entries) {
    bump(byGradingPeriod, e.gradingPeriod);
    for (const area of e.tags.areas) bump(byArea, area);
    for (const std of e.tags.standards) bump(byStandard, std);

    // Re-derive this entry's sentiments from its bank ids; fall back to stored.
    const derived: Sentiment[] = [];
    for (const id of e.usedEntries) {
      if (typeById.has(id)) derived.push(deriveSentiment(typeById.get(id)));
    }
    const sentiments: string[] = derived.length > 0 ? derived : e.tags.sentiments;
    for (const s of sentiments) bump(bySentiment, s);

    // Areas of growth-flavored entries feed the "top growth areas" ranking.
    if (sentiments.includes('growth')) {
      for (const area of e.tags.areas) bump(growthAreaCounts, area);
    }
  }

  const topGrowthAreas = Object.entries(growthAreaCounts)
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));

  return {
    total: entries.length,
    byArea,
    bySentiment,
    byGradingPeriod,
    byStandard,
    strengthGrowthBalance: {
      strength: bySentiment['strength'] ?? 0,
      growth: bySentiment['growth'] ?? 0,
    },
    topGrowthAreas,
  };
}
