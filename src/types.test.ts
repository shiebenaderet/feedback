// src/types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  Student,
  ClassMeta,
  SlotKind,
  Slot,
  BankTags,
  BankEntry,
  MessageDraft,
  Batch,
} from './types';

describe('canonical shared types (src/types.ts)', () => {
  it('Student has id/name/email and optional period', () => {
    const s: Student = { id: 's1', name: 'Carlos', email: 'carlos@example.com', period: '3' };
    expect(Object.keys(s)).toEqual(expect.arrayContaining(['id', 'name', 'email']));
    expect(s.id).toBe('s1');
    expect(s.name).toBe('Carlos');
    expect(s.email).toBe('carlos@example.com');

    // period is optional
    const minimal: Student = { id: 's2', name: 'Dana', email: 'dana@example.com' };
    expect(minimal.period).toBeUndefined();
  });

  it('ClassMeta has id/name and optional period/semester/unit', () => {
    const c: ClassMeta = {
      id: 'c1',
      name: 'Period 3 Biology',
      period: '3',
      semester: 'Spring',
      unit: 'Genetics',
    };
    expect(Object.keys(c)).toEqual(expect.arrayContaining(['id', 'name']));
    expect(c.id).toBe('c1');
    expect(c.name).toBe('Period 3 Biology');

    const minimal: ClassMeta = { id: 'c2', name: 'Period 1 Chemistry' };
    expect(minimal.semester).toBeUndefined();
  });

  it('SlotKind is exactly auto | fill', () => {
    const a: SlotKind = 'auto';
    const f: SlotKind = 'fill';
    expect([a, f]).toEqual(['auto', 'fill']);
  });

  it('Slot has key/kind and optional hint', () => {
    const slot: Slot = { key: 'name', kind: 'auto' };
    expect(Object.keys(slot)).toEqual(expect.arrayContaining(['key', 'kind']));
    expect(slot.key).toBe('name');
    expect(slot.kind).toBe('auto');

    const withHint: Slot = { key: 'favorite_lab', kind: 'fill', hint: 'their best lab' };
    expect(withHint.hint).toBe('their best lab');
  });

  it('BankTags has optional type/area/objective/tone', () => {
    const tags: BankTags = { type: 'success', area: 'lab', objective: 'precision', tone: 'warm' };
    expect(tags.type).toBe('success');
    expect(tags.area).toBe('lab');
    expect(tags.objective).toBe('precision');
    expect(tags.tone).toBe('warm');

    const empty: BankTags = {};
    expect(empty.type).toBeUndefined();
  });

  it('BankEntry has id/templateText/slots/tags', () => {
    const entry: BankEntry = {
      id: 'b1',
      templateText: 'Hi {name}, this {semester} you grew in {area}.',
      slots: [
        { key: 'name', kind: 'auto' },
        { key: 'semester', kind: 'auto' },
        { key: 'area', kind: 'fill', hint: 'area of growth' },
      ],
      tags: { type: 'growth', tone: 'encouraging' },
    };
    expect(Object.keys(entry)).toEqual(
      expect.arrayContaining(['id', 'templateText', 'slots', 'tags']),
    );
    expect(entry.slots).toHaveLength(3);
    expect(entry.slots[0].kind).toBe('auto');
    expect(entry.tags.type).toBe('growth');
  });

  it('MessageDraft has studentId/name/usedEntries/slotValues/finalText/status', () => {
    const draft: MessageDraft = {
      studentId: 's1',
      name: 'Carlos',
      usedEntries: ['b1', 'b2'],
      slotValues: { area: 'genetics' },
      finalText: 'Hi Carlos, this Spring you grew in genetics.',
      status: 'draft',
    };
    expect(Object.keys(draft)).toEqual(
      expect.arrayContaining([
        'studentId',
        'name',
        'usedEntries',
        'slotValues',
        'finalText',
        'status',
      ]),
    );
    expect(draft.usedEntries).toEqual(['b1', 'b2']);
    expect(draft.slotValues.area).toBe('genetics');

    // status is the draft|sent|failed union
    const sent: MessageDraft['status'] = 'sent';
    const failed: MessageDraft['status'] = 'failed';
    expect([draft.status, sent, failed]).toEqual(['draft', 'sent', 'failed']);
  });

  it('Batch has id/classId/sharedHeader/status', () => {
    const batch: Batch = {
      id: 'batch1',
      classId: 'c1',
      sharedHeader: 'End-of-year note',
      status: 'draft',
    };
    expect(Object.keys(batch)).toEqual(
      expect.arrayContaining(['id', 'classId', 'sharedHeader', 'status']),
    );

    // status is the draft|sending|sent union
    const sending: Batch['status'] = 'sending';
    const done: Batch['status'] = 'sent';
    expect([batch.status, sending, done]).toEqual(['draft', 'sending', 'sent']);
  });
});
