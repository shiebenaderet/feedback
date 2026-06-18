import { describe, it, expect } from 'vitest';
import {
  aggregateStudentTrajectories,
  distinctUnits,
  DEFAULT_OVERDUE_DAYS,
} from './aggregateStudentTrajectories';
import type { BankEntry, FeedbackHistoryEntry } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_000 * DAY; // a stable, large "now" in epoch ms

const bank: BankEntry[] = [
  { id: 'b-success', templateText: '', slots: [], tags: { type: 'success', area: 'cer' } },
  { id: 'b-growth', templateText: '', slots: [], tags: { type: 'growth', area: 'discussion' } },
  { id: 'b-growth2', templateText: '', slots: [], tags: { type: 'growth', area: 'research' } },
];

function entry(over: Partial<FeedbackHistoryEntry>): FeedbackHistoryEntry {
  return {
    id: Math.random().toString(36).slice(2),
    studentId: 's1',
    periodId: 'p1',
    courseId: 'c1',
    yearId: 'y1',
    sentAt: NOW,
    gradingPeriod: 'Q1',
    finalText: 'x',
    tags: { areas: [], sentiments: [], standards: [] },
    usedEntries: [],
    ...over,
  };
}

const students = [
  { id: 's1', name: 'Ada' },
  { id: 's2', name: 'Beto' },
  { id: 's3', name: 'Cleo' },
];

describe('aggregateStudentTrajectories', () => {
  it('includes every student, even those with no history', () => {
    const result = aggregateStudentTrajectories(students, [], { now: NOW });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.studentId).sort()).toEqual(['s1', 's2', 's3']);
    for (const r of result) {
      expect(r.total).toBe(0);
      expect(r.lastSentAt).toBeNull();
      expect(r.daysSinceLast).toBeNull();
      expect(r.overdue).toBe(true); // never contacted => overdue
    }
  });

  it('computes total, lastSentAt and daysSinceLast from max sentAt', () => {
    const history = [
      entry({ studentId: 's1', sentAt: NOW - 10 * DAY }),
      entry({ studentId: 's1', sentAt: NOW - 3 * DAY }),
      entry({ studentId: 's1', sentAt: NOW - 40 * DAY }),
    ];
    const r = aggregateStudentTrajectories(students, history, { now: NOW }).find(
      (x) => x.studentId === 's1',
    )!;
    expect(r.total).toBe(3);
    expect(r.lastSentAt).toBe(NOW - 3 * DAY);
    expect(r.daysSinceLast).toBe(3);
    expect(r.overdue).toBe(false); // 3 days < default 30
  });

  it('flags overdue past the threshold and honors a custom overdueDays', () => {
    const history = [entry({ studentId: 's1', sentAt: NOW - 45 * DAY })];
    const base = aggregateStudentTrajectories(students, history, { now: NOW });
    expect(base.find((x) => x.studentId === 's1')!.overdue).toBe(true);
    expect(base.find((x) => x.studentId === 's1')!.daysSinceLast).toBe(45);

    const lenient = aggregateStudentTrajectories(students, history, {
      now: NOW,
      overdueDays: 60,
    });
    expect(lenient.find((x) => x.studentId === 's1')!.overdue).toBe(false);
  });

  it('counts by grading period', () => {
    const history = [
      entry({ studentId: 's1', gradingPeriod: 'Q1' }),
      entry({ studentId: 's1', gradingPeriod: 'Q1' }),
      entry({ studentId: 's1', gradingPeriod: 'Q2' }),
    ];
    const r = aggregateStudentTrajectories(students, history, { now: NOW }).find(
      (x) => x.studentId === 's1',
    )!;
    expect(r.countsByGradingPeriod).toEqual({ Q1: 2, Q2: 1 });
  });

  it('derives strength vs growth from bank ids and ranks top growth areas', () => {
    const history = [
      entry({ studentId: 's1', usedEntries: ['b-success'], tags: { areas: ['cer'], sentiments: [], standards: [] } }),
      entry({ studentId: 's1', usedEntries: ['b-growth'], tags: { areas: ['discussion'], sentiments: [], standards: [] } }),
      entry({ studentId: 's1', usedEntries: ['b-growth2'], tags: { areas: ['discussion'], sentiments: [], standards: [] } }),
    ];
    const r = aggregateStudentTrajectories(students, history, {
      now: NOW,
      bankEntries: bank,
    }).find((x) => x.studentId === 's1')!;
    expect(r.strengthCount).toBe(1);
    expect(r.growthCount).toBe(2);
    // discussion appears twice (both growth entries tagged discussion).
    expect(r.topGrowthAreas[0]).toEqual({ area: 'discussion', count: 2 });
  });

  it('falls back to stored tags.sentiments when bank id is unresolved', () => {
    const history = [
      entry({
        studentId: 's1',
        usedEntries: ['unknown-id'],
        tags: { areas: ['cer'], sentiments: ['strength'], standards: [] },
      }),
    ];
    const r = aggregateStudentTrajectories(students, history, {
      now: NOW,
      bankEntries: bank,
    }).find((x) => x.studentId === 's1')!;
    expect(r.strengthCount).toBe(1);
  });

  it('sorts never-contacted first, then longest daysSinceLast descending', () => {
    const history = [
      entry({ studentId: 's1', sentAt: NOW - 5 * DAY }), // 5 days ago
      entry({ studentId: 's3', sentAt: NOW - 50 * DAY }), // 50 days ago
      // s2 has no history => never contacted
    ];
    const result = aggregateStudentTrajectories(students, history, { now: NOW });
    expect(result.map((r) => r.studentId)).toEqual(['s2', 's3', 's1']);
  });

  it('is deterministic given an injected now', () => {
    const history = [entry({ studentId: 's1', sentAt: NOW - 7 * DAY })];
    const a = aggregateStudentTrajectories(students, history, { now: NOW });
    const b = aggregateStudentTrajectories(students, history, { now: NOW });
    expect(a).toEqual(b);
  });

  it('exposes the default overdue threshold', () => {
    expect(DEFAULT_OVERDUE_DAYS).toBe(30);
  });
});

describe('distinctUnits', () => {
  it('returns sorted distinct non-empty units', () => {
    const history = [
      entry({ unit: 'Revolution' }),
      entry({ unit: 'Genetics' }),
      entry({ unit: 'Revolution' }),
      entry({ unit: '' }),
      entry({}), // unit undefined
    ];
    expect(distinctUnits(history)).toEqual(['Genetics', 'Revolution']);
  });

  it('returns an empty array when no units are present', () => {
    expect(distinctUnits([entry({}), entry({})])).toEqual([]);
  });
});
