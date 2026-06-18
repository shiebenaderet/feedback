import { useState, useMemo, useCallback, useRef } from 'react';
import type { BankEntry, Student, ClassMeta } from '../types';
import { assembleMessage } from './assembleMessage';
import { fillSlots } from './fillSlots';

export interface UseComposeMessageArgs {
  student: Student;
  classMeta: ClassMeta;
  allEntries: BankEntry[];
  /** Restores a previously-saved draft (resumed batch) so reloads don't lose work. */
  initial?: { usedEntries?: string[]; slotValues?: Record<string, string>; finalText?: string };
}

export interface UseComposeMessageResult {
  usedEntries: string[];
  slotValues: Record<string, string>;
  finalText: string;
  selectedEntries: BankEntry[];
  addEntry: (entryId: string) => void;
  removeEntry: (entryId: string) => void;
  setSlotValue: (key: string, val: string) => void;
  setText: (value: string) => void;
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

  // Live, template-driven preview. Unfilled fill-slots render as blanks (lenient).
  const assembled = useMemo(
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

  // Editable text + dirty flag. Seed from a resumed draft: if the saved finalText
  // differs from what the template would assemble for that draft, it was hand-edited
  // and must be preserved verbatim (dirty); otherwise it stays template-reactive (clean).
  const [{ text, dirty }, setEdit] = useState<{ text: string; dirty: boolean }>(() => {
    const seededText = initial?.finalText ?? '';
    if (initial?.finalText === undefined) {
      return { text: '', dirty: false };
    }
    const assembledFromInitial = assembleMessage({
      header: '',
      entries: (initial.usedEntries ?? [])
        .map((id) => allEntries.find((e) => e.id === id))
        .filter((e): e is BankEntry => !!e),
      student,
      classMeta,
      slotValues: initial.slotValues ?? {},
      lenient: true,
    });
    return { text: seededText, dirty: seededText !== assembledFromInitial };
  });

  // Mirror dirty/text into a ref so addEntry's callback (stable identity) can read
  // the latest values without resubscribing.
  const editRef = useRef({ text, dirty });
  editRef.current = { text, dirty };

  const finalText = dirty ? text : assembled;

  const setText = useCallback((value: string) => {
    setEdit({ text: value, dirty: true });
  }, []);

  const addEntry = useCallback(
    (entryId: string) => {
      // Always record usage so trends/history tags keep working.
      setUsedEntries((prev) => (prev.includes(entryId) ? prev : [...prev, entryId]));

      // When the teacher has taken manual control of the text, the assembled
      // preview no longer mirrors usedEntries — so append the entry's filled text.
      if (editRef.current.dirty) {
        const entry = byId.get(entryId);
        if (!entry) return;
        const chunk = fillSlots(entry, student, classMeta, slotValues, { lenient: true });
        setEdit((prev) => {
          const sep = prev.text.length > 0 ? '\n\n' : '';
          return { text: prev.text + sep + chunk, dirty: true };
        });
      }
    },
    [byId, student, classMeta, slotValues],
  );

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
    setText,
  };
}
