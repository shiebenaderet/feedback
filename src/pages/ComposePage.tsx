import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { createBatch, updateBatch } from '../firebase/batches';
import { findDraftBatch } from '../firebase/findDraftBatch';
import { saveMessageDraft, listMessages } from '../firebase/messages';
import { resolveActiveYear } from '../data/activeYear';
import { loadComposeData, type ComposeData } from './loadComposeData';
import { ComposeScreen } from '../compose/ComposeScreen';
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
  /** Resumes an existing open draft batch for the period (prevents lost work on reload). */
  findDraftBatch: typeof findDraftBatch;
  /** Loads the saved message drafts for a resumed batch. */
  listMessages: typeof listMessages;
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
    resolveYearId: deps?.resolveYearId ?? ((d, u) => resolveActiveYear(d, u)),
    loadComposeData: deps?.loadComposeData ?? loadComposeData,
    createBatch: deps?.createBatch ?? createBatch,
    updateBatch: deps?.updateBatch ?? updateBatch,
    saveMessageDraft: deps?.saveMessageDraft ?? saveMessageDraft,
    findDraftBatch: deps?.findDraftBatch ?? findDraftBatch,
    listMessages: deps?.listMessages ?? listMessages,
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
  // Quick-round targeting. `targetIds` (persisted to the batch) is the ACTIVE
  // subset; `selection` is the in-progress checkbox picks before the teacher
  // commits a focus round.
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [selection, setSelection] = useState<Set<string>>(new Set());

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
      .then(async (d) => {
        if (!d || !alive) return;
        setData(d);
        if (batchStarted.current) return;
        batchStarted.current = true;

        // RESUME an existing open draft for this period so a page reload never
        // loses work; only start a fresh batch when there's nothing to resume.
        // Resilient: if the lookup fails (e.g. index still building), fall back
        // to a fresh batch rather than blocking compose.
        const resume = async (b: { id: string; sharedHeader?: string; targetStudentIds?: string[] }) => {
          setBatchId(b.id);
          setSharedHeader(b.sharedHeader ?? '');
          // Restore an active quick-round subset so a reload keeps the focus.
          if (alive) {
            const ids = b.targetStudentIds ?? [];
            setTargetIds(ids);
            setSelection(new Set(ids));
          }
          const saved = await api.listMessages(db, uid, b.id);
          if (alive) setDrafts(Object.fromEntries(saved.map((m) => [m.studentId, m])));
        };

        const existing = await api.findDraftBatch(db, uid, periodId).catch(() => null);
        if (!alive) return;
        if (existing) {
          await resume(existing);
          return;
        }
        const id = await api.createBatch(db, uid, {
          periodId,
          courseId: d.courseId,
          yearId: d.yearId,
          sharedHeader: '',
        });
        if (!alive) return;
        // Re-check: another tab may have created a draft during the create gap.
        // If so, adopt the canonical (deterministic) one and abandon ours.
        const canonical = await api.findDraftBatch(db, uid, periodId).catch(() => null);
        if (!alive) return;
        if (canonical && canonical.id !== id) {
          await resume(canonical);
          return;
        }
        if (alive) setBatchId(id);
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

  // Toggle a student in/out of the in-progress quick-round selection.
  const toggleSelection = useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Commit the checkbox selection as the active quick round, persisting it to
  // the batch (review respects targetStudentIds for its skipped-student warning).
  const focusRound = useCallback(
    (ids: string[]) => {
      setTargetIds(ids);
      if (!batchId) return;
      void api.updateBatch(db, uid, batchId, {
        targetStudentIds: ids,
      } as Parameters<typeof api.updateBatch>[3]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, batchId],
  );

  // Clear the quick round → back to a full-roster round.
  const clearRound = useCallback(() => {
    setTargetIds([]);
    setSelection(new Set());
    if (!batchId) return;
    void api.updateBatch(db, uid, batchId, {
      targetStudentIds: [],
    } as Parameters<typeof api.updateBatch>[3]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, batchId]);

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

  // Quick round derived state. A round is "focused" when targetIds is non-empty;
  // only target students count for the focused view (de-emphasize the rest).
  const targetSet = new Set(targetIds);
  const quickRoundActive = targetIds.length > 0;
  const selectedCount = selection.size;

  return (
    <>
      <NavBar />
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/home' },
          { label: data.period.label },
        ]}
      />
      <main style={{ maxWidth: 1600, margin: '0 auto', padding: tokens.space(4) }}>
        <h1 style={{ marginTop: 0 }}>Write feedback · {data.period.label}</h1>

        <label
          htmlFor="shared-header"
          style={{ color: tokens.color.muted, fontSize: 13, marginBottom: tokens.space(3), maxWidth: 640 }}
        >
          Shared header (top of every message)
          <textarea
            id="shared-header"
            value={sharedHeader}
            onChange={(e) => onHeaderChange(e.target.value)}
            rows={2}
            placeholder="e.g. End-of-quarter feedback — Period 1"
            style={{ width: '100%', resize: 'vertical' }}
          />
        </label>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '230px minmax(0, 1fr)',
            gap: tokens.space(2),
            alignItems: 'start',
          }}
        >
          <nav
            aria-label="Roster"
            style={{
              ...cardStyle(),
              padding: tokens.space(2),
              maxHeight: 'calc(100vh - 220px)',
              overflowY: 'auto',
              position: 'sticky',
              top: tokens.space(2),
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

            {/* Quick round (subset targeting). */}
            <div
              data-testid="quick-round-controls"
              style={{ margin: `0 0 ${tokens.space(2)}px` }}
            >
              {quickRoundActive ? (
                <div style={{ display: 'grid', gap: 4 }}>
                  <span
                    data-testid="quick-round-indicator"
                    style={{ color: tokens.color.teal, fontSize: 13, fontWeight: 600 }}
                  >
                    Quick round: {targetIds.length} students
                  </span>
                  <button
                    type="button"
                    onClick={clearRound}
                    style={{
                      justifySelf: 'start',
                      cursor: 'pointer',
                      background: 'transparent',
                      color: tokens.color.muted,
                      border: 'none',
                      padding: 0,
                      fontSize: 12,
                      textDecoration: 'underline',
                    }}
                  >
                    Clear quick round
                  </button>
                </div>
              ) : (
                selectedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => focusRound([...selection])}
                    style={{
                      width: '100%',
                      cursor: 'pointer',
                      background: 'transparent',
                      color: tokens.color.teal,
                      border: `1px solid ${tokens.color.teal}`,
                      borderRadius: tokens.radius.sm,
                      padding: '6px 8px',
                      fontSize: 13,
                    }}
                  >
                    Focus round on {selectedCount} selected
                  </button>
                )
              )}
            </div>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
              {data.students.map((s, i) => {
                const active = i === index;
                const done = progress.doneIds.has(s.id);
                const targeted = targetSet.has(s.id);
                // De-emphasize non-target students once a quick round is active.
                const dimmed = quickRoundActive && !targeted;
                return (
                  <li
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      opacity: dimmed ? 0.45 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${s.name} for quick round`}
                      checked={selection.has(s.id)}
                      onChange={() => toggleSelection(s.id)}
                      style={{ flexShrink: 0, cursor: 'pointer' }}
                    />
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setIndex(i)}
                      style={{
                        display: 'flex',
                        flex: 1,
                        minWidth: 0,
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
                    <Link
                      to={`/student/${s.id}/history?year=${data.yearId}&course=${data.courseId}&period=${periodId}`}
                      aria-label={`History for ${s.name}`}
                      style={{
                        flexShrink: 0,
                        color: tokens.color.muted,
                        fontSize: 12,
                        textDecoration: 'none',
                        padding: '2px 4px',
                      }}
                    >
                      History
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

        {student && (
          <div style={{ minWidth: 0, display: 'grid', gap: tokens.space(2) }}>
            <ComposeScreen
              key={student.id}
              batchId={batchId}
              student={student}
              classMeta={classMeta}
              entries={data.entries}
              onAutoSave={onAutoSave}
              initialDraft={drafts[student.id]}
              history={studentHistory}
            />
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
            onClick={() =>
              setIndex((i) =>
                nextStudentIndex(
                  i,
                  data.students.length,
                  // Skip students already done; in a quick round, also skip any
                  // non-target student so "next" stays within the focused subset.
                  data.students.reduce<number[]>((acc, s, idx) => {
                    if (progress.doneIds.has(s.id) || (quickRoundActive && !targetSet.has(s.id))) {
                      acc.push(idx);
                    }
                    return acc;
                  }, []),
                ),
              )
            }
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
