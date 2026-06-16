// src/compose/assembleMessage.test.ts
import { describe, it, expect } from 'vitest';
import { assembleMessage } from './assembleMessage';
import { UnfilledSlotError } from './fillSlots';

// Shapes restated from the data model (spec):
// BankEntry: { id: string; templateText: string; slots: { key; kind: 'auto'|'fill'; hint? }[] }
// Student:   { name: string; email: string; period?: string }
// ClassMeta: { semester?: string }

const student = { name: 'Mia Lopez', email: 'mia@example.com', period: '3' };
const classMeta = { semester: 'Spring 2026' };

const entries = [
  {
    id: 'e1',
    templateText: 'Hi {name},',
    slots: [{ key: 'name', kind: 'auto' as const }],
  },
  {
    id: 'e2',
    templateText: 'You grew a lot in {topic} this {semester}.',
    slots: [
      { key: 'topic', kind: 'fill' as const },
      { key: 'semester', kind: 'auto' as const },
    ],
  },
];

describe('assembleMessage', () => {
  it('joins shared header + filled entries with blank lines', () => {
    const result = assembleMessage({
      header: 'Dear student,',
      entries,
      student,
      classMeta,
      slotValues: { topic: 'genetics' },
    });
    expect(result).toBe(
      'Dear student,\n\nHi Mia Lopez,\n\nYou grew a lot in genetics this Spring 2026.',
    );
  });

  it('omits the header when it is empty', () => {
    const result = assembleMessage({
      header: '',
      entries: [entries[0]],
      student,
      classMeta,
      slotValues: {},
    });
    expect(result).toBe('Hi Mia Lopez,');
  });

  it('propagates UnfilledSlotError from any entry', () => {
    expect(() =>
      assembleMessage({
        header: '',
        entries,
        student,
        classMeta,
        slotValues: {}, // topic missing
      }),
    ).toThrow(UnfilledSlotError);
  });

  it('returns empty string when there is no header and no entries', () => {
    const result = assembleMessage({
      header: '',
      entries: [],
      student,
      classMeta,
      slotValues: {},
    });
    expect(result).toBe('');
  });
});
