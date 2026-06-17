import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { createBatch, updateBatch } from '../firebase/batches';
import { saveMessageDraft } from '../firebase/messages';
import { loadComposeData, type ComposeData } from './loadComposeData';
import { ComposeScreen } from '../compose/ComposeScreen';
import { rosterProgress } from '../compose/rosterProgress';
import { nextStudentIndex } from '../compose/nextStudentIndex';
import type { ClassMeta, MessageDraft } from '../types';
import { tokens } from '../ui/theme';

export interface ComposePageDeps {
  uid: string;
  loadComposeData: typeof loadComposeData;
  createBatch: typeof createBatch;
  updateBatch: typeof updateBatch;
  saveMessageDraft: typeof saveMessageDraft;
}

export function ComposePage({ deps }: { deps?: Partial<ComposePageDeps> }) {
  const { classId = '' } = useParams();
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const api = {
    loadComposeData: deps?.loadComposeData ?? loadComposeData,
    createBatch: deps?.createBatch ?? createBatch,
    updateBatch: deps?.updateBatch ?? updateBatch,
    saveMessageDraft: deps?.saveMessageDraft ?? saveMessageDraft,
  };

  const [data, setData] = useState<ComposeData | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [sharedHeader, setSharedHeader] = useState('');
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, MessageDraft>>({});
  const [error, setError] = useState<string | null>(null);

  // createBatch must run EXACTLY once; this guard survives StrictMode double-invoke.
  const batchStarted = useRef(false);
  const headerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!uid || !classId) return;
    let alive = true;
    api
      .loadComposeData(db, uid, classId)
      .then((d) => {
        if (!alive) return;
        setData(d);
        if (!batchStarted.current) {
          batchStarted.current = true;
          // Phase 4 re-points this page to the year/course/period route and passes
          // the real tree ids. Transitionally, the route's id stands in for all three
          // so createBatch (now tree-keyed) compiles and the old route keeps working.
          api
            .createBatch(db, uid, {
              yearId: classId,
              courseId: classId,
              periodId: classId,
              sharedHeader: '',
            })
            .then((id) => {
            if (alive) setBatchId(id);
          });
        }
      })
      .catch(() => alive && setError('Could not load this class.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, classId]);

  // Persist the shared header to the batch (debounced) so it isn't lost at review.
  const onHeaderChange = useCallback(
    (value: string) => {
      setSharedHeader(value);
      if (!batchId) return;
      if (headerTimer.current) clearTimeout(headerTimer.current);
      headerTimer.current = setTimeout(() => {
        void api.updateBatch(db, uid, batchId, { sharedHeader: value });
      }, 600);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, batchId],
  );

  const onAutoSave = useCallback(
    (bId: string, draft: MessageDraft) => {
      setDrafts((prev) => ({ ...prev, [draft.studentId]: draft }));
      void api.saveMessageDraft(db, uid, bId, draft);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid],
  );

  if (error)
    return (
      <main style={{ maxWidth: 1180, margin: ' 0 auto', padding: tokens.space(4) }}>
        <p role="alert">{error}</p>
      </main>
    );
  if (!data || !batchId)
    return (
      <main>
        <p>Loading…</p>
      </main>
    );

  const student = data.students[index];
  const progress = rosterProgress(
    data.students,
    Object.values(drafts).map((d) => ({
      studentId: d.studentId,
      finalText: d.finalText,
      status: d.status,
    })),
  );

  return (
    <main>
      <h1>Write feedback · {data.classMeta.name}</h1>

      <label htmlFor="shared-header">Shared header (top of every message)</label>
      <textarea
        id="shared-header"
        value={sharedHeader}
        onChange={(e) => onHeaderChange(e.target.value)}
      />

      <div style={{ display: 'flex', gap: 16 }}>
        <nav aria-label="Roster" style={{ flex: '0 0 200px' }}>
          <p data-testid="roster-progress">
            {progress.doneCount} / {progress.total}
          </p>
          <ul>
            {data.students.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={i === index}
                  onClick={() => setIndex(i)}
                >
                  {s.name}
                  {progress.doneIds.has(s.id) ? ' ✓' : ''}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {student && (
          <ComposeScreen
            key={student.id}
            batchId={batchId}
            student={student}
            classMeta={data.classMeta as ClassMeta}
            entries={data.entries}
            onAutoSave={onAutoSave}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setIndex((i) => nextStudentIndex(i, data.students.length))}
      >
        Save &amp; next
      </button>

      {/* Compose → Review handoff (critic fix: the flow had no UI path out). */}
      <Link to={`/review/${batchId}`}>Review &amp; send →</Link>
    </main>
  );
}
