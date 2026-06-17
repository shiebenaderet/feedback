import { useState, useMemo, useCallback } from 'react';
import type { BankEntry, Student, ClassMeta } from '../types';
import { assembleMessage } from './assembleMessage';

export interface UseComposeMessageArgs {
  student: Student;
  classMeta: ClassMeta;
  allEntries: BankEntry[];
  /** Restores a previously-saved draft (resumed batch) so reloads don't lose work. */
  initial?: { usedEntries?: string[]; slotValues?: Record<string, string> };
}

export interface UseComposeMessageResult {
  usedEntries: string[];
  slotValues: Record<string, string>;
  finalText: string;
  selectedEntries: BankEntry[];
  addEntry: (entryId: string) => void;
  removeEntry: (entryId: string) => void;
  setSlotValue: (key: string, val: string) => void;
}

export function useComposeMessage({
  student,
  classMeta,
  allEntries,
  initial,
}: UseComposeMessageArgs): UseComposeMessageResult {
  const [usedEntries, setUsedEntries] = useState<string[]>(initial?.usedEntries ?? []);
  const [slotValues, setSlotValues] = useState<Record<string, string>>(initial?.slotValues ?? {});

  const byId = useMemo(() => {
    const m = new Map<string, BankEntry>();
    for (const e of allEntries) m.set(e.id, e);
    return m;
  }, [allEntries]);

  const selectedEntries = useMemo(
    () => usedEntries.map((id) => byId.get(id)).filter((e): e is BankEntry => !!e),
    [usedEntries, byId],
  );

  const finalText = useMemo(
    () =>
      assembleMessage({
        header: '',
        entries: selectedEntries,
        student,
        classMeta,
        slotValues,
        lenient: true, // live preview: unfilled slots show as blanks, never throw
      }),
    [selectedEntries, student, classMeta, slotValues],
  );

  const addEntry = useCallback((entryId: string) => {
    setUsedEntries((prev) => (prev.includes(entryId) ? prev : [...prev, entryId]));
  }, []);

  const removeEntry = useCallback((entryId: string) => {
    setUsedEntries((prev) => prev.filter((id) => id !== entryId));
  }, []);

  const setSlotValue = useCallback((key: string, val: string) => {
    setSlotValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  return {
    usedEntries,
    slotValues,
    finalText,
    selectedEntries,
    addEntry,
    removeEntry,
    setSlotValue,
  };
}
