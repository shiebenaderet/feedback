import { useEffect, useState } from 'react';
import type { CopyPasteMessage } from './CopyPastePanel';
import { tokens, tealButtonStyle, panelStyle } from '../ui/theme';

export interface SendStepperProps {
  messages: CopyPasteMessage[];
  sent: Record<string, boolean>;
  onMarkSent: (id: string) => void;
  onMarkAllSent: () => void;
  /** Shared email subject line; shown so Mode-B users can copy it into Gmail. */
  subject?: string;
}

/**
 * One-student-at-a-time copy-paste send screen — the primary send path when
 * Gmail API sending is unavailable. Big, readable message; two-click copy
 * (body + address, matching Gmail's two paste targets); progress tracking;
 * Previous/Skip/jump navigation; keyboard shortcuts (⌘C body, ⌘↵ mark & next).
 */
export function SendStepper({
  messages,
  sent,
  onMarkSent,
  onMarkAllSent,
  subject,
}: SendStepperProps) {
  const [index, setIndex] = useState(0);
  const current = messages[index];
  const total = messages.length;
  const sentCount = messages.filter((m) => sent[m.id]).length;

  const copy = (text: string) => void navigator.clipboard.writeText(text);
  const goto = (i: number) => setIndex(Math.max(0, Math.min(total - 1, i)));

  const markSentAndNext = () => {
    if (!current) return;
    onMarkSent(current.id);
    goto(index + 1);
  };

  // Keyboard shortcuts: ⌘C copies the body, ⌘↵ marks sent & advances.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        markSentAndNext();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!current) {
    return <p style={{ color: tokens.color.muted }}>No messages to send.</p>;
  }

  const pct = total === 0 ? 0 : Math.round((sentCount / total) * 100);

  return (
    <div
      style={{
        background: tokens.color.bg,
        color: tokens.color.text,
        fontFamily: tokens.font,
        borderRadius: tokens.radius.md,
        padding: tokens.space(3),
        maxWidth: 900,
      }}
    >
      {/* progress */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 13,
          color: tokens.color.muted,
          marginBottom: 6,
        }}
      >
        <span>Copy-paste send</span>
        <span style={{ color: tokens.color.teal, fontWeight: 600 }}>
          {sentCount} of {total} sent
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={sentCount}
        aria-valuemax={total}
        style={{
          height: 4,
          background: tokens.color.panelAlt,
          borderRadius: 99,
          overflow: 'hidden',
          marginBottom: tokens.space(3),
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: tokens.color.teal }} />
      </div>

      {/* student card */}
      <div style={{ ...panelStyle(), padding: tokens.space(3) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {current.name}
              {sent[current.id] && (
                <span style={{ marginLeft: 10, fontSize: 13, color: tokens.color.teal }}>
                  ✓ already sent
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: 13,
                  color: tokens.color.muted,
                }}
              >
                {current.email}
              </span>
              <button
                type="button"
                onClick={() => copy(current.email)}
                style={{
                  background: tokens.color.panelAlt,
                  color: tokens.color.teal,
                  border: `1px solid ${tokens.color.border}`,
                  borderRadius: 7,
                  padding: '3px 9px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Copy address
              </button>
            </div>
          </div>
          <span style={{ fontSize: 12, color: tokens.color.muted }}>
            Student {index + 1} of {total}
          </span>
        </div>

        {/* subject */}
        {subject && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: tokens.space(1.5) }}>
            <span style={{ fontSize: 13, color: tokens.color.subtle }}>
              Subject: {subject}
            </span>
            <button
              type="button"
              onClick={() => copy(subject)}
              style={{
                background: tokens.color.panelAlt,
                color: tokens.color.teal,
                border: `1px solid ${tokens.color.border}`,
                borderRadius: 7,
                padding: '3px 9px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Copy subject
            </button>
          </div>
        )}

        {/* message */}
        <div
          style={{
            marginTop: tokens.space(2),
            background: tokens.color.bg,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.md,
            padding: tokens.space(2.5),
            fontSize: 15.5,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            color: '#dce0e7',
          }}
        >
          {current.finalText}
        </div>

        {/* primary actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: tokens.space(2.5), alignItems: 'center' }}>
          <button type="button" onClick={() => copy(current.finalText)} style={tealButtonStyle()}>
            📋 Copy email body
          </button>
          <span style={{ fontSize: 13, color: tokens.color.muted }}>then paste into Gmail →</span>
          <button
            type="button"
            onClick={markSentAndNext}
            style={{
              marginLeft: 'auto',
              background: tokens.color.panelAlt,
              color: tokens.color.text,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.md,
              padding: '12px 20px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Mark sent &amp; next →
          </button>
        </div>
      </div>

      {/* nav row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: tokens.space(2),
        }}
      >
        <button
          type="button"
          onClick={() => goto(index - 1)}
          disabled={index === 0}
          style={{
            background: 'none',
            color: index === 0 ? tokens.color.border : tokens.color.muted,
            border: 'none',
            fontSize: 14,
            cursor: index === 0 ? 'default' : 'pointer',
          }}
        >
          ← Previous
        </button>
        <span style={{ fontSize: 12, color: tokens.color.muted }}>
          ⌘C copies the body · ⌘↵ marks sent &amp; advances
        </span>
        <button
          type="button"
          onClick={() => goto(index + 1)}
          style={{ background: 'none', color: tokens.color.muted, border: 'none', fontSize: 14, cursor: 'pointer' }}
        >
          Skip →
        </button>
      </div>

      {/* jump chips */}
      <div style={{ ...panelStyle(), marginTop: tokens.space(2), padding: tokens.space(2) }}>
        <div
          style={{
            fontSize: 12,
            color: tokens.color.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 10,
          }}
        >
          Jump to a student
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {messages.map((m, i) => {
            const isCurrent = i === index;
            const isSent = !!sent[m.id];
            return (
              <button
                key={m.id}
                type="button"
                aria-label={`Jump to ${m.name}`}
                onClick={() => goto(i)}
                style={{
                  fontSize: 12,
                  padding: '3px 9px',
                  borderRadius: 99,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: isCurrent ? 600 : 400,
                  background: isCurrent
                    ? tokens.color.teal
                    : isSent
                      ? 'rgba(95,184,168,0.12)'
                      : tokens.color.panelAlt,
                  color: isCurrent
                    ? '#0d1311'
                    : isSent
                      ? tokens.color.teal
                      : tokens.color.muted,
                }}
              >
                {isSent && !isCurrent ? '✓ ' : ''}
                {m.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onMarkAllSent}
          style={{
            marginTop: tokens.space(2),
            background: 'none',
            color: tokens.color.muted,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Mark all sent
        </button>
      </div>
    </div>
  );
}
