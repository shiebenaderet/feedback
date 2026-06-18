// src/review/ReviewScreen.tsx
import { useState, useMemo } from 'react';
import { grammarCheck, type GrammarIssue } from '../grammar/grammarCheck';
import { tokens, cardStyle, panelStyle } from '../ui/theme';

// Per-student message snapshot for review.
export interface ReviewMessage {
  id: string;
  name: string;
  email: string;
  finalText: string;
}

export interface ReviewScreenProps {
  messages: ReviewMessage[];
  onConfirm: () => void;
  /** Roster students with no message (or an empty one) — they will NOT be sent feedback. */
  unmessagedNames?: string[];
}

/** Matches a leftover {token} placeholder that was never filled in. */
const UNFILLED_SLOT_RE = /\{[a-zA-Z0-9_]+\}/;

interface SafetyFlags {
  unfilled: boolean;
  empty: boolean;
}

function safetyCheck(finalText: string): SafetyFlags {
  return {
    unfilled: UNFILLED_SLOT_RE.test(finalText),
    empty: finalText.trim().length === 0,
  };
}

const warnStyle = {
  display: 'block',
  color: tokens.color.danger,
  fontWeight: 600,
  fontSize: 13,
  marginTop: 4,
} as const;

export function ReviewScreen({ messages, onConfirm, unmessagedNames = [] }: ReviewScreenProps) {
  const [reviewed, setReviewed] = useState(false);
  const [acknowledgedIssues, setAcknowledgedIssues] = useState(false);

  const flagsByMessage = useMemo(() => {
    const map: Record<string, GrammarIssue[]> = {};
    for (const m of messages) map[m.id] = grammarCheck(m.finalText);
    return map;
  }, [messages]);

  const safetyByMessage = useMemo(() => {
    const map: Record<string, SafetyFlags> = {};
    for (const m of messages) map[m.id] = safetyCheck(m.finalText);
    return map;
  }, [messages]);

  // Are there any send-safety issues (unfilled slots / empty messages)?
  const hasIssues = useMemo(
    () => Object.values(safetyByMessage).some((f) => f.unfilled || f.empty),
    [safetyByMessage],
  );

  // Total roster size: students with a message + students skipped entirely.
  const rosterTotal = messages.length + unmessagedNames.length;

  // Anything that should stop a careless one-click send: unfilled/empty
  // messages OR roster students who'd silently get nothing.
  const hasBlockers = hasIssues || unmessagedNames.length > 0;

  const confirmEnabled = reviewed && (!hasBlockers || acknowledgedIssues);

  return (
    <section aria-label="Review and send" style={{ display: 'grid', gap: tokens.space(2) }}>
      {unmessagedNames.length > 0 && (
        <div
          role="alert"
          style={{
            ...panelStyle(),
            borderColor: tokens.color.danger,
            color: tokens.color.danger,
            fontWeight: 600,
          }}
        >
          ⚠ {unmessagedNames.length} of {rosterTotal} students have no message — they will NOT
          receive feedback: {unmessagedNames.join(', ')}
        </div>
      )}

      <ol style={{ display: 'grid', gap: tokens.space(2), padding: 0, listStyle: 'none', margin: 0 }}>
        {messages.map((m) => {
          const issues = flagsByMessage[m.id];
          const flags = safetyByMessage[m.id];
          return (
            <li key={m.id} style={{ ...cardStyle() }}>
              <div>
                <strong>{m.name}</strong>{' '}
                <span style={{ color: tokens.color.muted }}>{m.email}</span>
              </div>
              <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', color: tokens.color.subtle }}>
                {m.finalText}
              </p>

              {flags.empty && (
                <span role="alert" style={warnStyle}>
                  ⚠ Empty message — nothing to send
                </span>
              )}
              {flags.unfilled && (
                <span role="alert" style={warnStyle}>
                  ⚠ Unfilled blank — fill before sending
                </span>
              )}

              {issues.length > 0 && (
                <ul aria-label={`Grammar flags for ${m.name}`} style={{ margin: '8px 0 0', color: tokens.color.muted }}>
                  {issues.map((issue, i) => (
                    <li key={i}>{issue.message}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      <label style={{ display: 'block' }}>
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />{' '}
        I reviewed all {messages.length} messages and recipients
        {unmessagedNames.length > 0 ? ` (${unmessagedNames.length} student${
          unmessagedNames.length === 1 ? '' : 's'
        } skipped)` : ''}.
      </label>

      {hasBlockers && (
        <label style={{ display: 'block', color: tokens.color.danger, fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={acknowledgedIssues}
            onChange={(e) => setAcknowledgedIssues(e.target.checked)}
          />{' '}
          {hasIssues && unmessagedNames.length > 0
            ? 'I understand some messages have blanks/are empty and some students will get nothing, and I want to send anyway.'
            : hasIssues
              ? 'I understand some messages have unfilled blanks or are empty, and I want to send anyway.'
              : 'I understand some students have no message and will not receive feedback, and I want to send anyway.'}
        </label>
      )}

      <button type="button" disabled={!confirmEnabled} onClick={onConfirm} style={{ justifySelf: 'start' }}>
        Confirm and continue to send
      </button>
    </section>
  );
}
