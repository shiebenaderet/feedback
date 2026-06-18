import type { FeedbackHistoryEntry } from '../types';
import { summarizeHistoryEntry } from '../feedback/summarizeHistoryEntry';
import { tokens, panelStyle } from '../ui/theme';

export interface ComposeHistoryPanelProps {
  studentName: string;
  /** Already newest-first (as listStudentHistory returns them). */
  entries: FeedbackHistoryEntry[];
  /** Max summaries to show in the inline panel. */
  limit?: number;
  /**
   * Optional hook to drop a "build on last time" callback into the message
   * being composed. When provided, each entry gets a "Reference this" button.
   * Stays presentational — the parent owns how the text is inserted.
   */
  onInsert?: (text: string) => void;
}

/** Cap on the excerpt we quote back into the callback so it stays short. */
const EXCERPT_MAX = 80;

/** A short, quotable excerpt of what was said last time. */
function excerptFor(entry: FeedbackHistoryEntry): string {
  const source = entry.label?.trim() || entry.finalText;
  const collapsed = source.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= EXCERPT_MAX) return collapsed;
  const cut = collapsed.slice(0, EXCERPT_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** A teacher-finishable callback string, clearly meant to be completed by typing. */
export function buildCallbackText(entry: FeedbackHistoryEntry): string {
  return `Last time, I mentioned: "${excerptFor(entry)}". This time, `;
}

/**
 * Inline "what was sent before" panel for the compose flow. Presentational —
 * the caller loads entries via listStudentHistory and passes them in. Renders
 * one dated summary line per recent entry, optionally with a "Reference this"
 * button that builds a build-on-last-time callback via onInsert.
 */
export function ComposeHistoryPanel({
  studentName,
  entries,
  limit = 5,
  onInsert,
}: ComposeHistoryPanelProps) {
  const recent = entries.slice(0, limit);
  return (
    <aside
      className="compose-history"
      style={panelStyle()}
      aria-label={`Recent feedback for ${studentName}`}
    >
      <div
        className="label"
        style={{ color: tokens.color.muted, marginBottom: tokens.space(1) }}
      >
        Recent feedback
      </div>
      {recent.length === 0 ? (
        <p style={{ color: tokens.color.muted, margin: 0 }}>
          No feedback sent to {studentName} yet.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: tokens.space(1),
          }}
        >
          {recent.map((e) => (
            <li
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: tokens.space(1),
                color: tokens.color.subtle,
                fontSize: 13,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>{summarizeHistoryEntry(e)}</span>
              {onInsert && (
                <button
                  type="button"
                  onClick={() => onInsert(buildCallbackText(e))}
                  style={{
                    flexShrink: 0,
                    cursor: 'pointer',
                    background: 'transparent',
                    color: tokens.color.teal,
                    border: `1px solid ${tokens.color.teal}`,
                    borderRadius: tokens.radius.sm,
                    padding: '2px 8px',
                    fontSize: 12,
                  }}
                >
                  Reference this
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
