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
import { ComposeHistoryPanel } from '../compose/ComposeHistoryPanel';
import { NavBar } from '../components/NavBar';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { listStudentHistory } from '../data/listStudentHistory';
import { rosterProgress } from '../compose/rosterProgress';
import { nextStudentIndex } from '../compose/nextStudentIndex';
import type { ClassMeta, FeedbackHistoryEntry, MessageDraft } from '../types';
import { tokens, cardStyle, tealButtonStyle, progressTrackStyle, progressFillStyle } from '../ui/theme';

export interface ComposePageDeps {
  uid: string;
  /** Resolves the active year id; the test injects a fixed id. */
  resolveYearId: (db: typeof import('../firebase/config').db, uid: string) => Promise<string>;
  loadComposeData: typeof loadComposeData;
  createBatch: typeof createBatch;
  updateBatch: typeof updateBatch;
  saveMessageDraft: typeof saveMessageDraft;
  /** Loads the current student's prior feedback for the inline history panel. */
  listStudentHistory: (
    db: unknown,
    uid: string,
    loc: { yearId: string; courseId: string; periodId: string; studentId: string },
  ) => Promise<FeedbackHistoryEntry[]>;
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
    listStudentHistory:
      deps?.listStudentHistory ?? (listStudentHistory as ComposePageDeps['listStudentHistory']),
  };

  const [data, setData] = useState<ComposeData | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [sharedHeader, setSharedHeader] = useState('');
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, MessageDraft>>({});
  const [studentHistory, setStudentHistory] = useState<FeedbackHistoryEntry[]>([]);
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

  // Load the CURRENT student's prior feedback for the inline history panel.
  // Best-effort: an empty/failed read just shows the empty state, never blocks
  // composing (the history collection-group query may need an index).
  const currentStudentId = data?.students[index]?.id;
  useEffect(() => {
    // Clear immediately so the panel never shows the PREVIOUS student's history
    // (with the new student's name) during the async read.
    setStudentHistory([]);
    if (!uid || !data || !currentStudentId) {
      return;
    }
    let alive = true;
    api
      .listStudentHistory(db, uid, {
        yearId: data.yearId,
        courseId: data.courseId,
        periodId,
        studentId: currentStudentId,
      })
      .then((entries) => alive && setStudentHistory(entries))
      .catch(() => alive && setStudentHistory([]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, currentStudentId, periodId]);

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

  const pct = progress.total > 0 ? Math.round((progress.doneCount / progress.total) * 100) : 0;

  return (
    <>
      <NavBar />
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/home' },
          { label: data.period.label },
        ]}
      />
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: tokens.space(4) }}>
        <h1 style={{ marginTop: 0 }}>Write feedback · {data.period.label}</h1>

        <div style={{ display: 'grid', gap: 6, marginBottom: tokens.space(3), maxWidth: 640 }}>
          <label htmlFor="shared-header" style={{ color: tokens.color.muted, fontSize: 13 }}>
            Shared header (top of every message)
          </label>
          <textarea
            id="shared-header"
            value={sharedHeader}
            onChange={(e) => onHeaderChange(e.target.value)}
            rows={2}
            placeholder="e.g. End-of-quarter feedback — Period 1"
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: tokens.space(2), alignItems: 'flex-start' }}>
          <nav
            aria-label="Roster"
            style={{
              ...cardStyle(),
              flex: '0 0 220px',
              padding: tokens.space(2),
              maxHeight: 640,
              overflowY: 'auto',
            }}
          >
            <p
              data-testid="roster-progress"
              style={{ margin: 0, color: tokens.color.muted, fontSize: 13 }}
            >
              {progress.doneCount} / {progress.total} done
            </p>
            <div
              role="progressbar"
              aria-label="Roster progress"
              aria-valuenow={progress.doneCount}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              style={{ ...progressTrackStyle(), margin: `${tokens.space(1)}px 0 ${tokens.space(2)}px` }}
            >
              <div style={progressFillStyle(pct)} />
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
              {data.students.map((s, i) => {
                const active = i === index;
                const done = progress.doneIds.has(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setIndex(i)}
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        cursor: 'pointer',
                        background: active ? 'rgba(95,184,168,0.12)' : 'transparent',
                        color: active ? tokens.color.teal : tokens.color.text,
                        border: `1px solid ${active ? tokens.color.teal : 'transparent'}`,
                        borderRadius: tokens.radius.sm,
                        padding: '6px 8px',
                        fontSize: 14,
                      }}
                    >
                      <span>{s.name}</span>
                      {done && <span style={{ color: tokens.color.teal }}>✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

        {student && (
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: tokens.space(2) }}>
            <ComposeScreen
              key={student.id}
              batchId={batchId}
              student={student}
              classMeta={classMeta}
              entries={data.entries}
              onAutoSave={onAutoSave}
            />
            <ComposeHistoryPanel studentName={student.name} entries={studentHistory} />
          </div>
        )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.space(2),
            marginTop: tokens.space(3),
          }}
        >
          <button
            type="button"
            onClick={() => setIndex((i) => nextStudentIndex(i, data.students.length))}
            style={{ ...tealButtonStyle(), padding: '8px 16px' }}
          >
            Save & next
          </button>
          {/* Compose → Review handoff. */}
          <Link to={`/review/${batchId}`} style={{ color: tokens.color.teal, fontWeight: 600 }}>
            Review & send →
          </Link>
        </div>
      </main>
    </>
  );
}
