import { useEffect, useRef } from 'react';
import type { BankEntry, Student, ClassMeta, MessageDraft, FeedbackHistoryEntry } from '../types';
import { useComposeMessage } from './useComposeMessage';
import { FillSlotInputs } from './FillSlotInputs';
import { ComposeHistoryPanel } from './ComposeHistoryPanel';
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
  initialDraft?: { usedEntries?: string[]; slotValues?: Record<string, string>; finalText?: string };
  /** Current student's prior feedback, newest-first; powers the inline history panel. */
  history?: FeedbackHistoryEntry[];
  debounceMs?: number;
}

export function ComposeScreen({
  batchId,
  student,
  classMeta,
  entries,
  onAutoSave,
  initialDraft,
  history = [],
  debounceMs = 800,
}: ComposeScreenProps) {
  const compose = useComposeMessage({
    student,
    classMeta,
    allEntries: entries,
    initial: initialDraft,
  });
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Build-on-last-time: append a teacher-finishable callback into the message,
  // marking it dirty so the typed text is what gets saved.
  const insertCallback = (text: string) => {
    compose.setText(compose.finalText ? `${compose.finalText}\n\n${text}` : text);
  };

  const typeOptions = deriveTypeOptions(entries);
  // Keep the bank's natural/given order — do NOT float slot-free generic
  // comments to the top, which nudges rushed teachers toward boilerplate.
  // Personalized {slot} templates stay equally visible.
  const visibleEntries = filterEntriesByType(entries, typeFilter);

  // Generic-message nudge: the message uses at least one comment but no personal
  // /you-fill ("fill") slot is filled with a value — i.e. it's entirely generic.
  // Non-blocking; just a soft hint.
  const fillKeys = compose.selectedEntries.flatMap((e) =>
    e.slots.filter((s) => s.kind === 'fill').map((s) => s.key),
  );
  const hasFilledPersonalSlot = fillKeys.some(
    (key) => (compose.slotValues[key] ?? '').trim().length > 0,
  );
  const showSpecificityNudge = compose.usedEntries.length > 0 && !hasFilledPersonalSlot;

  // Debounced auto-save: fire only after the user has touched the message
  // (skip the initial empty stub so we never persist usedEntries:[]/slotValues:{}).
  const touchedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A save is "pending" once the debounce timer is armed and not yet flushed.
  const pendingRef = useRef(false);
  if (
    compose.usedEntries.length > 0 ||
    Object.keys(compose.slotValues).length > 0 ||
    compose.finalText.length > 0
  ) {
    touchedRef.current = true;
  }

  // Latest draft inputs, mirrored into refs so the unmount-only flush effect can
  // read current values without re-subscribing (its dep array is empty).
  const draftRef = useRef<MessageDraft>(null as unknown as MessageDraft);
  draftRef.current = {
    studentId: student.id,
    name: student.name,
    usedEntries: compose.usedEntries,
    slotValues: compose.slotValues,
    finalText: compose.finalText,
    status: 'draft',
  };
  const onAutoSaveRef = useRef(onAutoSave);
  onAutoSaveRef.current = onAutoSave;
  const batchIdRef = useRef(batchId);
  batchIdRef.current = batchId;

  // Synchronously persist a still-pending draft (used on unmount so the last
  // keystrokes within the debounce window aren't dropped when ComposePage
  // remounts the screen via key={student.id}).
  const flushNow = () => {
    if (!touchedRef.current || !pendingRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = false;
    onAutoSaveRef.current(batchIdRef.current, draftRef.current);
  };

  useEffect(() => {
    if (!touchedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = true;
    timerRef.current = setTimeout(() => {
      pendingRef.current = false;
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

  // Unmount-only flush: if a save is still pending when the screen unmounts
  // (e.g. "Save & next" remounts via key), persist it immediately rather than
  // letting the debounce cleanup just clearTimeout and lose the edit.
  useEffect(() => () => flushNow(), []);

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
        <textarea
          data-testid="final-text"
          value={compose.finalText}
          onChange={(e) => compose.setText(e.target.value)}
          placeholder="Pick comments from the bank → or type your own message"
          style={{
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            margin: 0,
            minHeight: 120,
            resize: 'vertical',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: tokens.font,
            fontSize: 15,
            lineHeight: 1.5,
            color: tokens.color.text,
            background: tokens.color.panelAlt,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.md,
            padding: tokens.space(2),
          }}
        />
        {showSpecificityNudge && (
          <p
            data-testid="specificity-nudge"
            style={{
              margin: `${tokens.space(1)}px 0 0`,
              color: tokens.color.muted,
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            Tip: add a specific example to make this personal.
          </p>
        )}
        <div style={{ marginTop: tokens.space(2) }}>
          <FillSlotInputs
            selectedEntries={compose.selectedEntries}
            slotValues={compose.slotValues}
            setSlotValue={compose.setSlotValue}
          />
        </div>
        <div style={{ marginTop: tokens.space(2) }}>
          <ComposeHistoryPanel
            studentName={student.name}
            entries={history}
            onInsert={insertCallback}
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
