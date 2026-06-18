import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useComposeMessage } from './useComposeMessage';
import type { BankEntry, Student, ClassMeta } from '../types';

const student: Student = { id: 's1', name: 'Carlos', email: 'carlos@example.com' };
const classMeta: ClassMeta = { id: 'c1', name: 'Period 3 Biology', semester: 'spring' };

const entries: BankEntry[] = [
  {
    id: 'e1',
    templateText: '{name} grew this {semester} when {moment}.',
    slots: [
      { key: 'name', kind: 'auto' },
      { key: 'semester', kind: 'auto' },
      { key: 'moment', kind: 'fill', hint: 'a specific moment' },
    ],
    tags: { type: 'growth' },
  },
  { id: 'e2', templateText: 'Nice collaboration.', slots: [], tags: { type: 'behavior' } },
];

function setup(initial?: Parameters<typeof useComposeMessage>[0]['initial']) {
  return renderHook(() =>
    useComposeMessage({ student, classMeta, allEntries: entries, initial }),
  );
}

describe('useComposeMessage dual mode', () => {
  it('clean: finalText mirrors the assembled template as entries are added', () => {
    const { result } = setup();
    expect(result.current.finalText).toBe('');
    act(() => result.current.addEntry('e2'));
    expect(result.current.finalText).toBe('Nice collaboration.');
    expect(result.current.usedEntries).toEqual(['e2']);
  });

  it('setText marks dirty and finalText reflects the typed value', () => {
    const { result } = setup();
    act(() => result.current.setText('I wrote this myself.'));
    expect(result.current.finalText).toBe('I wrote this myself.');
  });

  it('addEntry while dirty appends the filled chunk and still records usage', () => {
    const { result } = setup();
    act(() => result.current.setText('Intro line.'));
    act(() => result.current.addEntry('e2'));
    expect(result.current.finalText).toBe('Intro line.\n\nNice collaboration.');
    // usage still tracked for trends/history
    expect(result.current.usedEntries).toEqual(['e2']);
  });

  it('addEntry while dirty appends into empty text without a leading blank line', () => {
    const { result } = setup();
    act(() => result.current.setText(''));
    act(() => result.current.addEntry('e2'));
    expect(result.current.finalText).toBe('Nice collaboration.');
  });

  it('seeds clean from a purely template-built resumed draft (stays reactive)', () => {
    const { result } = setup({
      usedEntries: ['e2'],
      slotValues: {},
      finalText: 'Nice collaboration.',
    });
    expect(result.current.finalText).toBe('Nice collaboration.');
    act(() => result.current.addEntry('e1'));
    expect(result.current.finalText).toContain('Nice collaboration.');
    expect(result.current.finalText).toContain('Carlos grew this spring when');
  });

  it('seeds dirty from a hand-edited resumed draft (preserved verbatim)', () => {
    const { result } = setup({
      usedEntries: ['e2'],
      slotValues: {},
      finalText: 'Totally custom text.',
    });
    expect(result.current.finalText).toBe('Totally custom text.');
  });

  it('does not crash when initial is undefined', () => {
    const { result } = setup(undefined);
    expect(result.current.finalText).toBe('');
  });
});
