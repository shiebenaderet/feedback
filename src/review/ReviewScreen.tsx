// src/review/ReviewScreen.tsx
import { useState, useMemo } from 'react';
import { grammarCheck, type GrammarIssue } from '../grammar/grammarCheck';

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
}

export function ReviewScreen({ messages, onConfirm }: ReviewScreenProps) {
  const [reviewed, setReviewed] = useState(false);

  const flagsByMessage = useMemo(() => {
    const map: Record<string, GrammarIssue[]> = {};
    for (const m of messages) map[m.id] = grammarCheck(m.finalText);
    return map;
  }, [messages]);

  return (
    <section aria-label="Review and send">
      <ol>
        {messages.map((m) => {
          const issues = flagsByMessage[m.id];
          return (
            <li key={m.id}>
              <div>
                <strong>{m.name}</strong> <span>{m.email}</span>
              </div>
              <p>{m.finalText}</p>
              {issues.length > 0 && (
                <ul aria-label={`Grammar flags for ${m.name}`}>
                  {issues.map((issue, i) => (
                    <li key={i}>{issue.message}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      <label>
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        I reviewed all {messages.length} messages and recipients.
      </label>

      <button type="button" disabled={!reviewed} onClick={onConfirm}>
        Confirm and continue to send
      </button>
    </section>
  );
}
