// src/compose/MessageBuilder.tsx

export interface MessageBuilderProps {
  studentName: string;
  header: string;
  finalText: string;
  onTextChange: (value: string) => void;
  onSaveAndNext: () => void;
}

/**
 * Middle panel of the compose screen: shows whose message this is, the shared header,
 * a spellcheck-enabled textarea bound to finalText, and the Save & next button.
 */
export function MessageBuilder({
  studentName,
  header,
  finalText,
  onTextChange,
  onSaveAndNext,
}: MessageBuilderProps) {
  return (
    <section aria-label="Message builder">
      <h2>Composing for {studentName}</h2>

      {header.trim() !== '' && (
        <p className="shared-header" data-testid="shared-header">
          {header}
        </p>
      )}

      <textarea
        aria-label="Message"
        spellCheck
        value={finalText}
        onChange={(e) => onTextChange(e.target.value)}
        rows={12}
      />

      <button type="button" onClick={onSaveAndNext}>
        Save & next
      </button>
    </section>
  );
}
