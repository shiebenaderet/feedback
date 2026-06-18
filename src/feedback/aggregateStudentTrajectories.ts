import type { BankEntry, FeedbackHistoryEntry } from '../types';
import { GRADING_PERIODS, deriveSentiment, type Sentiment } from './taxonomy';

export type CountMap = Record<string, number>;

/** Default number of days with no contact after which a student is "overdue". */
export const DEFAULT_OVERDUE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** One student's longitudinal trajectory, rolled up across all their entries. */
export interface StudentTrajectory {
  studentId: string;
  name: string;
  /** Total feedback entries this student has received. */
  total: number;
  /** Max sentAt across the student's entries, or null if never contacted. */
  lastSentAt: number | null;
  /** Whole days since lastSentAt (floored), or null if never contacted. */
  daysSinceLast: number | null;
  /** Entry counts keyed by grading period (only present periods appear). */
  countsByGradingPeriod: CountMap;
  /** Count of strength-flavored entries across all of the student's feedback. */
  strengthCount: number;
  /** Count of growth-flavored entries across all of the student's feedback. */
  growthCount: number;
  /** Growth-sentiment entries' areas, most frequent first (small list). */
  topGrowthAreas: Array<{ area: string; count: number }>;
  /** True when never contacted, or daysSinceLast exceeds the overdue threshold. */
  overdue: boolean;
}

export interface AggregateTrajectoriesOpts {
  /** Injected "now" (epoch ms) for deterministic daysSinceLast/overdue. */
  now?: number;
  /** Days without contact past which a student is overdue (default 30). */
  overdueDays?: number;
  /** Bank entries so sentiment can be re-derived from raw usedEntries. */
  bankEntries?: BankEntry[];
}

function bump(map: CountMap, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

/** Resolve an entry's sentiments, re-derived from bank ids with stored fallback. */
function entrySentiments(
  e: FeedbackHistoryEntry,
  typeById: Map<string, string | undefined>,
): string[] {
  const derived: Sentiment[] = [];
  for (const id of e.usedEntries) {
    if (typeById.has(id)) derived.push(deriveSentiment(typeById.get(id)));
  }
  return derived.length > 0 ? derived : e.tags.sentiments;
}

/**
 * Pure, deterministic per-student trajectory roll-up over feedbackHistory.
 *
 * Sentiment is RE-DERIVED from each entry's raw `usedEntries` (bank ids) through
 * the taxonomy's deriveSentiment, matching aggregateTrends; stored
 * `tags.sentiments` is the fallback when a bank id is no longer resolvable.
 *
 * EVERY student in `students` is returned, including those with NO history —
 * those are the most important (never contacted). Results are sorted most-needy
 * first: never-contacted students lead, then by longest daysSinceLast descending,
 * with name as a stable tiebreaker. Inject `now` to keep output deterministic.
 */
export function aggregateStudentTrajectories(
  students: Array<{ id: string; name: string }>,
  history: FeedbackHistoryEntry[],
  opts: AggregateTrajectoriesOpts = {},
): StudentTrajectory[] {
  const now = opts.now ?? Date.now();
  const overdueDays = opts.overdueDays ?? DEFAULT_OVERDUE_DAYS;
  const typeById = new Map(
    (opts.bankEntries ?? []).map((b) => [b.id, b.tags.type]),
  );

  // Group history by student so each roll-up touches only its own entries.
  const byStudent = new Map<string, FeedbackHistoryEntry[]>();
  for (const e of history) {
    const list = byStudent.get(e.studentId);
    if (list) list.push(e);
    else byStudent.set(e.studentId, [e]);
  }

  const trajectories: StudentTrajectory[] = students.map((student) => {
    const entries = byStudent.get(student.id) ?? [];

    const countsByGradingPeriod: CountMap = {};
    const growthAreaCounts: CountMap = {};
    let strengthCount = 0;
    let growthCount = 0;
    let lastSentAt: number | null = null;

    for (const e of entries) {
      bump(countsByGradingPeriod, e.gradingPeriod);
      if (lastSentAt === null || e.sentAt > lastSentAt) lastSentAt = e.sentAt;

      const sentiments = entrySentiments(e, typeById);
      if (sentiments.includes('strength')) strengthCount += 1;
      if (sentiments.includes('growth')) {
        growthCount += 1;
        for (const area of e.tags.areas) bump(growthAreaCounts, area);
      }
    }

    const topGrowthAreas = Object.entries(growthAreaCounts)
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area))
      .slice(0, 3);

    const daysSinceLast =
      lastSentAt === null ? null : Math.floor((now - lastSentAt) / DAY_MS);
    const overdue =
      lastSentAt === null || (daysSinceLast !== null && daysSinceLast > overdueDays);

    return {
      studentId: student.id,
      name: student.name,
      total: entries.length,
      lastSentAt,
      daysSinceLast,
      countsByGradingPeriod,
      strengthCount,
      growthCount,
      topGrowthAreas,
      overdue,
    };
  });

  // Most-needy first: never-contacted (null lastSentAt) lead, then longest
  // daysSinceLast descending, name as a stable final tiebreaker.
  return trajectories.sort((a, b) => {
    if (a.lastSentAt === null && b.lastSentAt === null) {
      return a.name.localeCompare(b.name);
    }
    if (a.lastSentAt === null) return -1;
    if (b.lastSentAt === null) return 1;
    const diff = (b.daysSinceLast ?? 0) - (a.daysSinceLast ?? 0);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
}

/** Distinct, sorted `unit` values present in a history set (skips empty/undefined). */
export function distinctUnits(history: FeedbackHistoryEntry[]): string[] {
  const set = new Set<string>();
  for (const e of history) {
    if (e.unit && e.unit.trim() !== '') set.add(e.unit);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Re-export for callers that build "by grading period" UIs in canonical order. */
export { GRADING_PERIODS };
