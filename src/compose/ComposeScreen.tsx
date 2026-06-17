import { useEffect, useRef } from 'react';
import type { BankEntry, Student, ClassMeta, MessageDraft } from '../types';
import { useComposeMessage } from './useComposeMessage';
import { FillSlotInputs } from './FillSlotInputs';
import { deriveTypeOptions, filterEntriesByType } from './bankFilter';
import { useState } from 'react';
import { tokens, cardStyle, chipStyle } from '../ui/theme';

export interface ComposeScreenProps {
  batchId: string;
  student: Student;
  classMeta: ClassMeta;
  entries: BankEntry[];
  /** Debounced persistence sink — caller wires this to saveMessageDraft. */
  onAutoSave: (batchId: string, draft: MessageDraft) => void;
  /** A previously-saved draft for this student (resumed batch), restored on mount. */
  initialDraft?: { usedEntries?: string[]; slotValues?: Record<string, string> };
  debounceMs?: number;
}

export function ComposeScreen({
  batchId,
  student,
  classMeta,
  entries,
  onAutoSave,
  initialDraft,
  debounceMs = 800,
}: ComposeScreenProps) {
  const compose = useComposeMessage({
    student,
    classMeta,
    allEntries: entries,
    initial: initialDraft,
  });
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const typeOptions = deriveTypeOptions(entries);
  // Slot-free (generic) comments first — they're the fast picks for a full
  // roster; the personalized {slot} templates sink below.
  const visibleEntries = [...filterEntriesByType(entries, typeFilter)].sort(
    (a, b) => a.slots.length - b.slots.length,
  );

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

  const filterChip = (active: boolean) => ({
    ...chipStyle(active),
    cursor: 'pointer',
    color: active ? tokens.color.teal : tokens.color.subtle,
    textTransform: 'capitalize' as const,
  });

  return (
    <div
      className="compose-screen"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 1fr)',
        gap: tokens.space(2),
        alignItems: 'start',
      }}
    >
      {/* MIDDLE: the message being composed */}
      <div className="compose-builder" style={{ ...cardStyle(), minWidth: 0 }}>
        <div
          className="label"
          style={{ color: tokens.color.muted, fontSize: 13, marginBottom: tokens.space(1) }}
        >
          {student.name}'s message
        </div>
        <pre
          data-testid="final-text"
          style={{
            margin: 0,
            minHeight: 120,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: tokens.font,
            fontSize: 15,
            lineHeight: 1.5,
            color: compose.finalText ? tokens.color.text : tokens.color.muted,
            background: tokens.color.panelAlt,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.md,
            padding: tokens.space(2),
          }}
        >
          {compose.finalText || 'Pick comments from the bank →'}
        </pre>
        <div style={{ marginTop: tokens.space(2) }}>
          <FillSlotInputs
            selectedEntries={compose.selectedEntries}
            slotValues={compose.slotValues}
            setSlotValue={compose.setSlotValue}
          />
        </div>
      </div>

      {/* RIGHT: bank picker */}
      <div className="compose-bank" style={{ ...cardStyle(), minWidth: 0 }}>
        <div
          className="label"
          style={{ color: tokens.color.muted, fontSize: 13, marginBottom: tokens.space(1) }}
        >
          Bank · filter
        </div>
        <div
          className="bank-filter-chips"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: tokens.space(2) }}
        >
          <button
            type="button"
            aria-pressed={typeFilter === null}
            onClick={() => setTypeFilter(null)}
            style={filterChip(typeFilter === null)}
          >
            all
          </button>
          {typeOptions.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={typeFilter === t}
              onClick={() => setTypeFilter((cur) => (cur === t ? null : t))}
              style={filterChip(typeFilter === t)}
            >
              {t}
            </button>
          ))}
        </div>
        <ul
          className="bank-entries"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: tokens.space(1),
            maxHeight: 460,
            overflowY: 'auto',
          }}
        >
          {visibleEntries.map((e) => {
            const used = compose.usedEntries.includes(e.id);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  data-testid={`add-${e.id}`}
                  onClick={() => compose.addEntry(e.id)}
                  disabled={used}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    cursor: used ? 'default' : 'pointer',
                    background: used ? tokens.color.panel : tokens.color.panelAlt,
                    color: used ? tokens.color.muted : tokens.color.text,
                    border: `1px solid ${used ? tokens.color.teal : tokens.color.border}`,
                    borderRadius: tokens.radius.md,
                    padding: tokens.space(1.5),
                    fontSize: 13,
                    lineHeight: 1.4,
                    opacity: used ? 0.6 : 1,
                  }}
                >
                  {used ? '✓ ' : '+ '}
                  {e.templateText}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
