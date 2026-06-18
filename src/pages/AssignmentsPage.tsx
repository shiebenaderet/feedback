import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Firestore } from 'firebase/firestore';
import { NavBar } from '../components/NavBar';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { resolveActiveYear } from '../data/activeYear';
import {
  createAssignment,
  listAssignments,
  deleteAssignment,
  type NewAssignmentInput,
} from '../data/assignments';
import { listPeriods } from '../data/periods';
import { courseComponents, labelForCode } from '../standards/standards';
import type { Assignment, Period } from '../types';
import { tokens, cardStyle, panelStyle, tealButtonStyle, chipStyle } from '../ui/theme';

/** Data deps are injectable so the test drives the page without Firebase. */
export interface AssignmentsPageDeps {
  uid: string;
  /** Resolves the active year id; the test injects a fixed id. */
  resolveYearId: (db: Firestore, uid: string) => Promise<string>;
  listAssignments: (
    db: Firestore,
    uid: string,
    yearId: string,
    courseId: string,
  ) => Promise<Assignment[]>;
  listPeriods: (
    db: Firestore,
    uid: string,
    yearId: string,
    courseId: string,
  ) => Promise<Period[]>;
  createAssignment: (
    db: Firestore,
    uid: string,
    yearId: string,
    courseId: string,
    input: NewAssignmentInput,
  ) => Promise<string>;
  deleteAssignment: (
    db: Firestore,
    uid: string,
    yearId: string,
    courseId: string,
    assignmentId: string,
  ) => Promise<void>;
}

export function AssignmentsPage({ deps }: { deps?: Partial<AssignmentsPageDeps> }) {
  const { courseId = '' } = useParams();
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const api = {
    resolveYearId: deps?.resolveYearId ?? ((d: Firestore, u: string) => resolveActiveYear(d, u)),
    listAssignments: deps?.listAssignments ?? listAssignments,
    listPeriods: deps?.listPeriods ?? listPeriods,
    createAssignment: deps?.createAssignment ?? createAssignment,
    deleteAssignment: deps?.deleteAssignment ?? deleteAssignment,
  };

  const [yearId, setYearId] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [error, setError] = useState<string | null>(null);

  // New-assignment form state.
  const [title, setTitle] = useState('');
  const [summative, setSummative] = useState(true);
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set());
  const [selectedStandards, setSelectedStandards] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Standards that map to this course (Grade 8 + Skills), labeled for the picker.
  const standardOptions = useMemo(() => courseComponents(), []);

  useEffect(() => {
    if (!uid || !courseId) return;
    let alive = true;
    (async () => {
      try {
        const yid = await api.resolveYearId(db, uid);
        if (!alive) return;
        setYearId(yid);
        const [list, ps] = await Promise.all([
          api.listAssignments(db, uid, yid, courseId),
          api.listPeriods(db, uid, yid, courseId),
        ]);
        if (!alive) return;
        setAssignments(list);
        setPeriods(ps);
      } catch {
        if (alive) setError('Could not load assignments.');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, courseId]);

  const togglePeriod = (id: string) =>
    setSelectedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleStandard = (code: string) =>
    setSelectedStandards((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      // Cap at 3 linked standards.
      else if (next.size < 3) next.add(code);
      return next;
    });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !yearId || submitting) return;
    setSubmitting(true);
    try {
      await api.createAssignment(db, uid, yearId, courseId, {
        title: trimmed,
        standardCodes: Array.from(selectedStandards),
        summative,
        periodIds: Array.from(selectedPeriods),
      });
      // Refresh the list so the new assignment appears (newest first).
      const list = await api.listAssignments(db, uid, yearId, courseId);
      setAssignments(list);
      // Reset the form.
      setTitle('');
      setSummative(true);
      setSelectedPeriods(new Set());
      setSelectedStandards(new Set());
    } catch {
      setError('Could not save the assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await api.deleteAssignment(db, uid, yearId, courseId, id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError('Could not delete the assignment.');
    }
  };

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 980, margin: '0 auto', padding: tokens.space(4) }}>
        <p style={{ marginTop: 0 }}>
          <Link to="/home" style={{ color: tokens.color.teal }}>
            ← Back to Home
          </Link>
        </p>
        <h1 style={{ marginTop: 0 }}>Assignments</h1>
        {error && <p role="alert">{error}</p>}

        <form
          onSubmit={onSubmit}
          aria-label="New assignment"
          style={{ ...cardStyle(), display: 'grid', gap: tokens.space(2), marginBottom: tokens.space(3) }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>New assignment</h2>

          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ color: tokens.color.muted, fontSize: 13 }}>Title</span>
            <input
              type="text"
              aria-label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. DBQ: Causes of the Revolution"
              style={{
                background: tokens.color.panelAlt,
                color: tokens.color.text,
                border: `1px solid ${tokens.color.border}`,
                borderRadius: tokens.radius.md,
                padding: '8px 12px',
                fontSize: 15,
                fontFamily: tokens.font,
              }}
            />
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: tokens.color.subtle, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={summative}
              onChange={(e) => setSummative(e.target.checked)}
            />
            Summative
          </label>

          <fieldset
            style={{
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.md,
              padding: tokens.space(1.5),
              display: 'grid',
              gap: tokens.space(1),
            }}
          >
            <legend style={{ color: tokens.color.muted, fontSize: 13, padding: '0 6px' }}>
              Periods
            </legend>
            {periods.length === 0 ? (
              <span style={{ color: tokens.color.muted, fontSize: 13 }}>No periods yet.</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(1) }}>
                {periods.map((p) => (
                  <label key={p.id} style={chipStyle(selectedPeriods.has(p.id))}>
                    <input
                      type="checkbox"
                      aria-label={`Period ${p.label}`}
                      checked={selectedPeriods.has(p.id)}
                      onChange={() => togglePeriod(p.id)}
                      style={{ marginRight: 4 }}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset
            style={{
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.md,
              padding: tokens.space(1.5),
              display: 'grid',
              gap: tokens.space(1),
            }}
          >
            <legend style={{ color: tokens.color.muted, fontSize: 13, padding: '0 6px' }}>
              Standards (pick 1–3)
            </legend>
            <div style={{ display: 'grid', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
              {standardOptions.map((c) => {
                const checked = selectedStandards.has(c.code);
                const atCap = !checked && selectedStandards.size >= 3;
                return (
                  <label
                    key={c.code}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 6,
                      fontSize: 13,
                      color: atCap ? tokens.color.muted : tokens.color.subtle,
                      opacity: atCap ? 0.6 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      aria-label={labelForCode(c.code)}
                      checked={checked}
                      disabled={atCap}
                      onChange={() => toggleStandard(c.code)}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <span>{labelForCode(c.code)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={!title.trim() || submitting}
            style={{ ...tealButtonStyle(!title.trim() || submitting), justifySelf: 'start' }}
          >
            Create assignment
          </button>
        </form>

        <h2 style={{ fontSize: 18 }}>Existing assignments</h2>
        {assignments.length === 0 ? (
          <p style={{ color: tokens.color.muted }}>No assignments yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: tokens.space(1.5) }}>
            {assignments.map((a) => (
              <li key={a.id} style={{ ...panelStyle() }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space(1) }}>
                  <Link
                    to={`/course/${courseId}/assignment/${a.id}`}
                    style={{ flex: 1, color: tokens.color.text, fontWeight: 600, fontSize: 16 }}
                  >
                    {a.title}
                  </Link>
                  {a.summative && (
                    <span style={chipStyle(true)} data-testid={`summative-${a.id}`}>
                      Summative
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Delete ${a.title}`}
                    onClick={() => void onDelete(a.id)}
                    style={{
                      background: 'transparent',
                      color: tokens.color.danger,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    Delete
                  </button>
                </div>
                {a.standardCodes.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: tokens.space(1) }}>
                    {a.standardCodes.map((code) => (
                      <span key={code} style={chipStyle(false)} title={labelForCode(code)}>
                        {code}
                      </span>
                    ))}
                  </div>
                )}
                <p style={{ margin: `${tokens.space(1)}px 0 0` }}>
                  <Link
                    to={`/course/${courseId}/assignment/${a.id}`}
                    style={{ color: tokens.color.teal, fontSize: 14 }}
                  >
                    Standards-based feedback →
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
