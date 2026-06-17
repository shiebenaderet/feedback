// src/types.redesign.test.ts
import { describe, it, expect } from 'vitest';
import type {
  Year,
  Course,
  Period,
  FeedbackHistoryEntry,
} from './types';
import type { GradingPeriod } from './feedback/taxonomy';

describe('redesign canonical types (src/types.ts)', () => {
  it('Year has id/label', () => {
    const y: Year = { id: 'y2025', label: '2025–2026' };
    expect(Object.keys(y)).toEqual(expect.arrayContaining(['id', 'label']));
    expect(y.id).toBe('y2025');
    expect(y.label).toBe('2025–2026');
  });

  it('Course has id/name and optional archived', () => {
    const c: Course = { id: 'c1', name: 'Period 3 Biology' };
    expect(Object.keys(c)).toEqual(expect.arrayContaining(['id', 'name']));
    expect(c.archived).toBeUndefined();

    const archived: Course = { id: 'c2', name: 'Old Chem', archived: true };
    expect(archived.archived).toBe(true);
  });

  it('Period has id/label/order', () => {
    const p: Period = { id: 'p1', label: 'Q1', order: 0 };
    expect(Object.keys(p)).toEqual(expect.arrayContaining(['id', 'label', 'order']));
    expect(p.order).toBe(0);
  });

  it('FeedbackHistoryEntry carries ids, sentAt, gradingPeriod, finalText, derived tags, usedEntries', () => {
    const gradingPeriod: GradingPeriod = 'EOY';
    const entry: FeedbackHistoryEntry = {
      studentId: 's1',
      periodId: 'p1',
      courseId: 'c1',
      yearId: 'y2025',
      sentAt: 1718539200000,
      gradingPeriod,
      label: 'End-of-year note',
      finalText: 'Hi Carlos, this year you grew in lab precision.',
      tags: {
        areas: ['lab'],
        sentiments: ['growth'],
        standards: ['NGSS-HS-LS1'],
      },
      usedEntries: ['b1', 'b2'],
    };

    expect(Object.keys(entry)).toEqual(
      expect.arrayContaining([
        'studentId',
        'periodId',
        'courseId',
        'yearId',
        'sentAt',
        'gradingPeriod',
        'finalText',
        'tags',
        'usedEntries',
      ]),
    );
    expect(entry.tags.areas).toEqual(['lab']);
    expect(entry.tags.sentiments).toEqual(['growth']);
    expect(entry.tags.standards).toEqual(['NGSS-HS-LS1']);
    expect(entry.usedEntries).toEqual(['b1', 'b2']);
    expect(entry.gradingPeriod).toBe('EOY');
  });

  it('FeedbackHistoryEntry.label is optional', () => {
    const entry: FeedbackHistoryEntry = {
      studentId: 's1',
      periodId: 'p1',
      courseId: 'c1',
      yearId: 'y2025',
      sentAt: 1718539200000,
      gradingPeriod: 'Q1',
      finalText: 'Great quarter.',
      tags: { areas: [], sentiments: [], standards: [] },
      usedEntries: [],
    };
    expect(entry.label).toBeUndefined();
  });
});
