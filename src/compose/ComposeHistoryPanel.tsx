import type { FeedbackHistoryEntry } from '../types';
import { summarizeHistoryEntry } from '../feedback/summarizeHistoryEntry';
import { tokens, panelStyle } from '../ui/theme';

export interface ComposeHistoryPanelProps {
  studentName: string;
  /** Already newest-first (as listStudentHistory returns them). */
  entries: FeedbackHistoryEntry[];
  /** Max summaries to show in the inline panel. */
  limit?: number;
}

/**
 * Inline "what was sent before" panel for the compose flow. Purely
 * presentational — the caller loads entries via listStudentHistory and passes
 * them in. Renders one dated summary line per recent entry.
 */
export function ComposeHistoryPanel({
  studentName,
  entries,
  limit = 5,
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
            <li key={e.id} style={{ color: tokens.color.subtle, fontSize: 13 }}>
              {summarizeHistoryEntry(e)}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
