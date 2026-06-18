// src/send/CopyPastePanel.tsx

// Per-student message for the copy-paste fallback.
export interface CopyPasteMessage {
  id: string;
  name: string;
  email: string;
  finalText: string;
  /** Optional email subject line, surfaced so Mode-B users can see/copy it. */
  subject?: string;
}

export interface CopyPastePanelProps {
  messages: CopyPasteMessage[];
  sent: Record<string, boolean>;
  onMarkSent: (id: string) => void;
  onMarkAllSent: () => void;
}

export function CopyPastePanel({
  messages,
  sent,
  onMarkSent,
  onMarkAllSent,
}: CopyPastePanelProps) {
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  return (
    <section aria-label="Copy-paste send (Mode B)">
      <button type="button" onClick={onMarkAllSent}>
        Mark all sent
      </button>
      <ol>
        {messages.map((m) => (
          <li key={m.id}>
            <div>
              <strong>{m.name}</strong>{' '}
              <span>{m.email}</span>{' '}
              {sent[m.id] && <span aria-label={`${m.name} sent`}>✓ sent</span>}
            </div>
            <pre>{m.finalText}</pre>
            <button type="button" onClick={() => copy(m.finalText)}>
              Copy
            </button>
            <button type="button" onClick={() => onMarkSent(m.id)}>
              Mark as sent
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
