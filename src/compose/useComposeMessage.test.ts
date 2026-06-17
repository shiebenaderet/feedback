import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useComposeMessage } from './useComposeMessage';
import type { BankEntry, Student, ClassMeta } from '../types';

const student: Student = { id: 's1', name: 'Carlos', email: 'carlos@example.com' };
const classMeta: ClassMeta = { id: 'c1', name: 'Period 3 Biology', semester: 'spring' };

const growthEntry: BankEntry = {
  id: 'e1',
  templateText: '{name} showed real growth this {semester}, especially when {moment}.',
  slots: [
    { key: 'name', kind: 'auto' },
    { key: 'semester', kind: 'auto' },
    { key: 'moment', kind: 'fill', hint: 'a specific moment' },
  ],
  tags: { type: 'growth' },
};

const successEntry: BankEntry = {
  id: 'e2',
  templateText: 'One thing to keep pushing is {area}.',
  slots: [{ key: 'area', kind: 'fill', hint: 'an area' }],
  tags: { type: 'success' },
};

const allEntries = [growthEntry, successEntry];

describe('useComposeMessage', () => {
  it('starts with no entries, empty slotValues, and empty finalText', () => {
    const { result } = renderHook(() =>
      useComposeMessage({ student, classMeta, allEntries }),
    );
    expect(result.current.usedEntries).toEqual([]);
    expect(result.current.slotValues).toEqual({});
    expect(result.current.finalText).toBe('');
  });

  it('addEntry adds the entry id and auto-fills name/semester in finalText', () => {
    const { result } = renderHook(() =>
      useComposeMessage({ student, classMeta, allEntries }),
    );
    act(() => result.current.addEntry('e1'));
    expect(result.current.usedEntries).toEqual(['e1']);
    // auto slots resolved; the still-blank fill slot leaves no orphan space
    // before the period (lenient preview tidies empty optional slots).
    expect(result.current.finalText).toBe(
      'Carlos showed real growth this spring, especially when.',
    );
  });

  it('addEntry is idempotent (no duplicate ids)', () => {
    const { result } = renderHook(() =>
      useComposeMessage({ student, classMeta, allEntries }),
    );
    act(() => result.current.addEntry('e1'));
    act(() => result.current.addEntry('e1'));
    expect(result.current.usedEntries).toEqual(['e1']);
  });

  it('setSlotValue updates finalText live', () => {
    const { result } = renderHook(() =>
      useComposeMessage({ student, classMeta, allEntries }),
    );
    act(() => result.current.addEntry('e1'));
    act(() => result.current.setSlotValue('moment', 'he redesigned the experiment'));
    expect(result.current.finalText).toBe(
      'Carlos showed real growth this spring, especially when he redesigned the experiment.',
    );
  });

  it('removeEntry drops the entry from finalText', () => {
    const { result } = renderHook(() =>
      useComposeMessage({ student, classMeta, allEntries }),
    );
    act(() => result.current.addEntry('e1'));
    act(() => result.current.addEntry('e2'));
    act(() => result.current.setSlotValue('moment', 'X'));
    act(() => result.current.setSlotValue('area', 'speaking up'));
    expect(result.current.finalText).toBe(
      'Carlos showed real growth this spring, especially when X.\n\n' +
        'One thing to keep pushing is speaking up.',
    );
    act(() => result.current.removeEntry('e1'));
    expect(result.current.usedEntries).toEqual(['e2']);
    expect(result.current.finalText).toBe('One thing to keep pushing is speaking up.');
  });
});
