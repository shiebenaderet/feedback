import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { NavBar } from '../components/NavBar';
import { listStudentHistory } from '../data/listStudentHistory';
import { summarizeHistoryEntry } from '../feedback/summarizeHistoryEntry';
import type { FeedbackHistoryEntry } from '../types';
import { tokens, panelStyle } from '../ui/theme';

export interface StudentHistoryPageDeps {
  uid: string;
  /** Structural signature (not typeof) so vi.fn mocks satisfy it. */
  listStudentHistory: (
    db: unknown,
    uid: string,
    loc: { yearId: string; courseId: string; periodId: string; studentId: string },
  ) => Promise<FeedbackHistoryEntry[]>;
}

/**
 * Per-student chronological feedback history at
 * /student/:studentId/history?year=&course=&period=. The tree location rides in
 * the query string so the page is reachable from any roster/compose link.
 */
export function StudentHistoryPage({ deps }: { deps?: Partial<StudentHistoryPageDeps> }) {
  const { studentId = '' } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const load =
    deps?.listStudentHistory ??
    (listStudentHistory as StudentHistoryPageDeps['listStudentHistory']);

  const yearId = params.get('year') ?? '';
  const courseId = params.get('course') ?? '';
  const periodId = params.get('period') ?? '';

  const [entries, setEntries] = useState<FeedbackHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !studentId) return;
    let alive = true;
    load(db, uid, { yearId, courseId, periodId, studentId })
      .then((e) => alive && setEntries(e))
      .catch(() => alive && setError('Could not load this student’s history.'));
    return () => {
      alive = false;
    };
  }, [uid, studentId, yearId, courseId, periodId, load]);

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 780, margin: '0 auto', padding: tokens.space(4) }}>
        <h1>Feedback history</h1>
        {error && <p role="alert">{error}</p>}
        {entries !== null && entries.length === 0 && (
          <p style={{ color: tokens.color.muted }}>No feedback history yet.</p>
        )}
        <div style={{ display: 'grid', gap: tokens.space(2) }}>
          {(entries ?? []).map((e) => (
            <article key={e.id} style={panelStyle()}>
              <div
                style={{ color: tokens.color.teal, fontSize: 13, marginBottom: tokens.space(1) }}
              >
                {summarizeHistoryEntry(e)}
              </div>
              <p style={{ margin: 0, color: tokens.color.text, whiteSpace: 'pre-wrap' }}>
                {e.finalText}
              </p>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
