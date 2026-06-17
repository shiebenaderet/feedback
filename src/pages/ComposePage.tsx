import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { createBatch, updateBatch } from '../firebase/batches';
import { saveMessageDraft } from '../firebase/messages';
import { getOrCreateCurrentYear } from '../data/years';
import { currentSchoolYearLabel } from '../data/currentSchoolYearLabel';
import { loadComposeData, type ComposeData } from './loadComposeData';
import { ComposeScreen } from '../compose/ComposeScreen';
import { NavBar } from '../components/NavBar';
import { rosterProgress } from '../compose/rosterProgress';
import { nextStudentIndex } from '../compose/nextStudentIndex';
import type { ClassMeta, MessageDraft } from '../types';
import { tokens } from '../ui/theme';

export interface ComposePageDeps {
  uid: string;
  /** Resolves the active year id; the test injects a fixed id. */
  resolveYearId: (db: typeof import('../firebase/config').db, uid: string) => Promise<string>;
  loadComposeData: typeof loadComposeData;
  createBatch: typeof createBatch;
  updateBatch: typeof updateBatch;
  saveMessageDraft: typeof saveMessageDraft;
}

export function ComposePage({ deps }: { deps?: Partial<ComposePageDeps> }) {
  const { courseId = '', periodId = '' } = useParams();
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const api = {
    resolveYearId:
      deps?.resolveYearId ?? ((d, u) => getOrCreateCurrentYear(d, u, currentSchoolYearLabel())),
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
    if (!uid || !courseId || !periodId) return;
    let alive = true;
    (async () => {
      // The compose target needs the active year (injectable for tests).
      const yearId = await api.resolveYearId(db, uid);
      if (!alive) return undefined;
      return api.loadComposeData(db, uid, { yearId, courseId, periodId });
    })()
      .then((d) => {
        if (!d || !alive) return;
        setData(d);
        if (!batchStarted.current) {
          batchStarted.current = true;
          api
            .createBatch(db, uid, {
              periodId,
              courseId: d.courseId,
              yearId: d.yearId,
              sharedHeader: '',
            })
            .then((id) => {
              if (alive) setBatchId(id);
            });
        }
      })
      .catch(() => alive && setError('Could not load this period.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, courseId, periodId]);

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

  // ComposeScreen's classMeta is the slot-fill context; the period stands in for it.
  const classMeta: ClassMeta = { id: data.period.id, name: data.period.label };

  return (
    <>
      <NavBar />
      <main>
        <h1>Write feedback · {data.period.label}</h1>

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
            classMeta={classMeta}
            entries={data.entries}
            onAutoSave={onAutoSave}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setIndex((i) => nextStudentIndex(i, data.students.length))}
      >
        Save & next
      </button>

      {/* Compose → Review handoff. */}
      <Link to={`/review/${batchId}`}>Review & send →</Link>
      </main>
    </>
  );
}
