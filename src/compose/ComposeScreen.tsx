import { useEffect, useRef } from 'react';
import type { BankEntry, Student, ClassMeta, MessageDraft } from '../types';
import { useComposeMessage } from './useComposeMessage';
import { FillSlotInputs } from './FillSlotInputs';
import { deriveTypeOptions, filterEntriesByType } from './bankFilter';
import { useState } from 'react';

export interface ComposeScreenProps {
  batchId: string;
  student: Student;
  classMeta: ClassMeta;
  entries: BankEntry[];
  /** Debounced persistence sink — caller wires this to saveMessageDraft. */
  onAutoSave: (batchId: string, draft: MessageDraft) => void;
  debounceMs?: number;
}

export function ComposeScreen({
  batchId,
  student,
  classMeta,
  entries,
  onAutoSave,
  debounceMs = 800,
}: ComposeScreenProps) {
  const compose = useComposeMessage({ student, classMeta, allEntries: entries });
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const typeOptions = deriveTypeOptions(entries);
  const visibleEntries = filterEntriesByType(entries, typeFilter);

  // Debounced auto-save: fire only after the user has touched the message
  // (skip the initial empty stub so we never persist usedEntries:[]/slotValues:{}).
  const touchedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (compose.usedEntries.length > 0 || Object.keys(compose.slotValues).length > 0) {
    touchedRef.current = true;
  }

  useEffect(() => {
    if (!touchedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const draft: MessageDraft = {
        studentId: student.id,
        name: student.name,
        usedEntries: compose.usedEntries,
        slotValues: compose.slotValues,
        finalText: compose.finalText,
        status: 'draft',
      };
      onAutoSave(batchId, draft);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    batchId,
    student.id,
    student.name,
    compose.usedEntries,
    compose.slotValues,
    compose.finalText,
    onAutoSave,
    debounceMs,
  ]);

  return (
    <div className="compose-screen" style={{ display: 'flex', gap: 14 }}>
      {/* MIDDLE: message builder */}
      <div className="compose-builder" style={{ flex: 1 }}>
        <div className="label">{student.name}'s message</div>
        <pre data-testid="final-text">{compose.finalText}</pre>
        <FillSlotInputs
          selectedEntries={compose.selectedEntries}
          slotValues={compose.slotValues}
          setSlotValue={compose.setSlotValue}
        />
      </div>

      {/* RIGHT: bank picker */}
      <div className="compose-bank" style={{ flex: '0 0 230px' }}>
        <div className="label">Bank · filter</div>
        <div className="bank-filter-chips">
          <button
            aria-pressed={typeFilter === null}
            onClick={() => setTypeFilter(null)}
          >
            all
          </button>
          {typeOptions.map((t) => (
            <button
              key={t}
              aria-pressed={typeFilter === t}
              onClick={() => setTypeFilter((cur) => (cur === t ? null : t))}
            >
              {t}
            </button>
          ))}
        </div>
        <ul className="bank-entries">
          {visibleEntries.map((e) => (
            <li key={e.id}>
              <button
                data-testid={`add-${e.id}`}
                onClick={() => compose.addEntry(e.id)}
                disabled={compose.usedEntries.includes(e.id)}
              >
                + {e.templateText.slice(0, 24)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
