import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Firestore } from 'firebase/firestore';
import { NavBar } from '../components/NavBar';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { resolveActiveYear } from '../data/activeYear';
import { getAssignment } from '../data/assignments';
import { listStudents } from '../data/students';
import { writeFeedbackHistory } from '../data/writeFeedbackHistory';
import { StandardsFeedbackPicker } from '../compose/StandardsFeedbackPicker';
import {
  GradingPeriodChooser,
  type GradingPeriodValue,
} from '../components/GradingPeriodChooser';
import { GRADING_PERIODS } from '../feedback/taxonomy';
import { labelForCode } from '../standards/standards';
import type { Assignment, Student } from '../types';
import { tokens, cardStyle, panelStyle, tealButtonStyle, periodChipStyle } from '../ui/theme';

/** Data deps are injectable so the test drives the page without Firebase. */
export interface AssignmentFeedbackPageDeps {
  uid: string;
  resolveYearId: (db: Firestore, uid: string) => Promise<string>;
  getAssignment: (
    db: Firestore,
    uid: string,
    yearId: string,
    courseId: string,
    assignmentId: string,
  ) => Promise<Assignment | null>;
  listStudents: (
    db: Firestore,
    uid: string,
    yearId: string,
    courseId: string,
    periodId: string,
  ) => Promise<Student[]>;
  writeFeedbackHistory: typeof writeFeedbackHistory;
}

/** Copy text to the clipboard, falling back to a hidden textarea when the
 *  async Clipboard API is unavailable (older browsers / insecure contexts). */
async function copyToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch {
    /* clipboard truly unavailable — nothing more we can do */
  }
}

export function AssignmentFeedbackPage({
  deps,
}: {
  deps?: Partial<AssignmentFeedbackPageDeps>;
}) {
  const { courseId = '', assignmentId = '' } = useParams();
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const api = {
    resolveYearId: deps?.resolveYearId ?? ((d: Firestore, u: string) => resolveActiveYear(d, u)),
    getAssignment: deps?.getAssignment ?? getAssignment,
    listStudents: deps?.listStudents ?? listStudents,
    writeFeedbackHistory: deps?.writeFeedbackHistory ?? writeFeedbackHistory,
  };

  const [yearId, setYearId] = useState('');
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [periodId, setPeriodId] = useState('');
  const [roster, setRoster] = useState<Student[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [posted, setPosted] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [gp, setGp] = useState<GradingPeriodValue>({
    gradingPeriod: GRADING_PERIODS[0],
    label: '',
  });

  // Load the assignment + resolve the active year, then default the period.
  useEffect(() => {
    if (!uid || !courseId || !assignmentId) return;
    let alive = true;
    (async () => {
      try {
        const yid = await api.resolveYearId(db, uid);
        if (!alive) return;
        setYearId(yid);
        const a = await api.getAssignment(db, uid, yid, courseId, assignmentId);
        if (!alive) return;
        if (!a) {
          setError('Assignment not found.');
          return;
        }
        setAssignment(a);
        setPeriodId(a.periodIds[0] ?? '');
      } catch {
        if (alive) setError('Could not load this assignment.');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, courseId, assignmentId]);

  // Load the roster for the selected period.
  useEffect(() => {
    if (!uid || !yearId || !courseId || !periodId) return;
    let alive = true;
    (async () => {
      try {
        const students = await api.listStudents(db, uid, yearId, courseId, periodId);
        if (alive) setRoster(students);
      } catch {
        if (alive) setError('Could not load the roster.');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, yearId, courseId, periodId]);

  const standardLabels = useMemo(
    () => (assignment ? assignment.standardCodes.map((c) => labelForCode(c)) : []),
    [assignment],
  );

  const appendComment = (studentId: string, text: string) =>
    setComments((prev) => {
      const existing = prev[studentId] ?? '';
      const joined = existing ? `${existing} ${text}` : text;
      return { ...prev, [studentId]: joined };
    });

  const markPosted = async (student: Student) => {
    if (!assignment) return;
    const finalText = comments[student.id] ?? '';
    try {
      await api.writeFeedbackHistory(db, uid, {
        draft: {
          studentId: student.id,
          name: student.name,
          usedEntries: [],
          slotValues: {},
          finalText,
          status: 'sent',
        },
        bankEntries: [],
        tree: { yearId, courseId, periodId },
        gradingPeriod: gp.gradingPeriod,
        label: assignment.title,
        unit: assignment.title,
        assignmentId: assignment.id,
        extraStandards: assignment.standardCodes,
        sentAt: Date.now(),
        // Deterministic batch id → `assignment_{id}__{studentId}` history doc id,
        // so re-marking the same student OVERWRITES instead of double-counting.
        batchId: `assignment_${assignment.id}`,
      });
      setPosted((prev) => ({ ...prev, [student.id]: true }));
    } catch {
      setError('Could not log this as posted.');
    }
  };

  if (error)
    return (
      <>
        <NavBar />
        <main style={{ maxWidth: 980, margin: '0 auto', padding: tokens.space(4) }}>
          <p role="alert">{error}</p>
          <p>
            <Link to={`/course/${courseId}/assignments`} style={{ color: tokens.color.teal }}>
              ← Back to assignments
            </Link>
          </p>
        </main>
      </>
    );

  if (!assignment)
    return (
      <main>
        <p>Loading…</p>
      </main>
    );

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 980, margin: '0 auto', padding: tokens.space(4) }}>
        <p style={{ marginTop: 0 }}>
          <Link to={`/course/${courseId}/assignments`} style={{ color: tokens.color.teal }}>
            ← Back to assignments
          </Link>
        </p>
        <h1 style={{ marginTop: 0 }}>{assignment.title}</h1>

        {standardLabels.length > 0 && (
          <ul
            aria-label="Linked standards"
            style={{ listStyle: 'none', padding: 0, margin: `0 0 ${tokens.space(2)}px`, display: 'grid', gap: 4 }}
          >
            {standardLabels.map((label) => (
              <li key={label} style={{ color: tokens.color.subtle, fontSize: 13 }}>
                {label}
              </li>
            ))}
          </ul>
        )}

        <p style={{ color: tokens.color.muted, fontSize: 14 }}>
          Copy each comment into Canvas SpeedGrader; mark posted to log it.
        </p>

        {assignment.periodIds.length > 1 && (
          <div
            role="group"
            aria-label="Period"
            style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(1), marginBottom: tokens.space(2) }}
          >
            {assignment.periodIds.map((pid) => (
              <button
                key={pid}
                type="button"
                aria-pressed={pid === periodId}
                onClick={() => setPeriodId(pid)}
                style={{ ...periodChipStyle(pid === periodId), cursor: 'pointer' }}
              >
                {pid}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginBottom: tokens.space(3) }}>
          <GradingPeriodChooser
            gradingPeriod={gp.gradingPeriod}
            label={gp.label}
            onChange={setGp}
          />
        </div>

        {roster.length === 0 ? (
          <p style={{ color: tokens.color.muted }}>No students in this period.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: tokens.space(2) }}>
            {roster.map((student) => {
              const value = comments[student.id] ?? '';
              const isPosted = posted[student.id];
              return (
                <li key={student.id} style={cardStyle()}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: tokens.space(1) }}>
                    <strong style={{ fontSize: 16 }}>{student.name}</strong>
                    <span style={{ color: tokens.color.muted, fontSize: 13 }}>{student.email}</span>
                    {isPosted && (
                      <span
                        data-testid={`posted-${student.id}`}
                        style={{ color: tokens.color.teal, fontWeight: 600, fontSize: 13 }}
                      >
                        posted ✓
                      </span>
                    )}
                  </div>

                  <textarea
                    aria-label={`Comment for ${student.name}`}
                    value={value}
                    onChange={(e) =>
                      setComments((prev) => ({ ...prev, [student.id]: e.target.value }))
                    }
                    rows={4}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      margin: `${tokens.space(1)}px 0`,
                      background: tokens.color.panelAlt,
                      color: tokens.color.text,
                      border: `1px solid ${tokens.color.border}`,
                      borderRadius: tokens.radius.md,
                      padding: tokens.space(1),
                      fontFamily: tokens.font,
                      fontSize: 14,
                      resize: 'vertical',
                    }}
                  />

                  <div style={{ ...panelStyle(), marginBottom: tokens.space(1) }}>
                    <StandardsFeedbackPicker
                      standardCodes={assignment.standardCodes}
                      studentName={student.name}
                      onInsert={(text) => appendComment(student.id, text)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: tokens.space(1) }}>
                    <button
                      type="button"
                      aria-label={`Copy comment for ${student.name}`}
                      onClick={() => void copyToClipboard(value)}
                      style={{
                        background: tokens.color.panelAlt,
                        color: tokens.color.text,
                        border: `1px solid ${tokens.color.border}`,
                        borderRadius: tokens.radius.md,
                        padding: '8px 14px',
                        fontSize: 14,
                        fontFamily: tokens.font,
                        cursor: 'pointer',
                      }}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      aria-label={`Mark posted for ${student.name}`}
                      onClick={() => void markPosted(student)}
                      style={tealButtonStyle()}
                    >
                      {isPosted ? 'Posted ✓' : 'Mark posted'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
