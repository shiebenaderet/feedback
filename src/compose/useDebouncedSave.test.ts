import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Firestore } from 'firebase/firestore';
import type { MessageDraft } from '../types';

// Mock the data layer so this is a pure hook/wiring test (no emulator).
// vi.hoisted so the mock fn exists when the hoisted factory runs.
const { saveMessageDraft } = vi.hoisted(() => ({
  saveMessageDraft: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../firebase/messages', () => ({ saveMessageDraft }));

import { useDebouncedSave } from './useDebouncedSave';

const fakeDb = {} as Firestore;
const UID = 'teacher-1';
const BATCH_ID = 'batch-abc';

const draftFor = (studentId: string, finalText: string): MessageDraft => ({
  studentId,
  name: 'Carlos',
  usedEntries: [],
  slotValues: { name: 'Carlos', semester: 'Spring' },
  finalText,
  status: 'draft',
});

beforeEach(() => {
  vi.useFakeTimers();
  saveMessageDraft.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedSave', () => {
  it('debounces and calls saveMessageDraft with db, uid, batchId, and the MessageDraft', () => {
    const { result } = renderHook(() =>
      useDebouncedSave(fakeDb, UID, BATCH_ID, 300),
    );

    act(() => {
      result.current(draftFor('stu-7', 'a'));
      result.current(draftFor('stu-7', 'ab'));
      result.current(draftFor('stu-7', 'abc'));
    });

    // Not yet — still within the debounce window.
    expect(saveMessageDraft).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Exactly once, with only the latest draft.
    expect(saveMessageDraft).toHaveBeenCalledTimes(1);
    expect(saveMessageDraft).toHaveBeenCalledWith(
      fakeDb,
      UID,
      BATCH_ID,
      draftFor('stu-7', 'abc'),
    );
  });

  it('uses the real batchId it was constructed with (no vestigial _value param)', () => {
    const { result } = renderHook(() =>
      useDebouncedSave(fakeDb, UID, 'batch-xyz', 300),
    );

    act(() => {
      result.current(draftFor('stu-9', 'hello'));
      vi.advanceTimersByTime(300);
    });

    expect(saveMessageDraft).toHaveBeenCalledWith(
      fakeDb,
      UID,
      'batch-xyz',
      draftFor('stu-9', 'hello'),
    );
    // The debounced fn takes exactly one arg: the MessageDraft.
    expect(result.current.length).toBe(1);
  });
});
