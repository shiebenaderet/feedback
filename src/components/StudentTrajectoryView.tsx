import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { StudentTrajectory } from '../feedback/aggregateStudentTrajectories';
import { GRADING_PERIODS } from '../feedback/taxonomy';
import { formatHistoryDate } from '../feedback/summarizeHistoryEntry';
import { tokens, cardStyle, chipStyle } from '../ui/theme';

export interface StudentTrajectoryViewProps {
  trajectories: StudentTrajectory[];
  /** Tree location for building each student's history link. */
  yearId: string;
  courseId: string;
  periodId: string;
}

/** Build the per-student history href the dashboard rows link to. */
function historyHref(
  studentId: string,
  yearId: string,
  courseId: string,
  periodId: string,
): string {
  return `/student/${studentId}/history?year=${yearId}&course=${courseId}&period=${periodId}`;
}

/** "Q1:2 Q2:1" compact arc across the grading periods this student has any of. */
function GradingPeriodArc({ counts }: { counts: Record<string, number> }) {
  const present = GRADING_PERIODS.filter((p) => counts[p] != null);
  if (present.length === 0) {
    return <span style={{ color: tokens.color.muted }}>—</span>;
  }
  return (
    <span style={{ display: 'inline-flex', gap: tokens.space(1), flexWrap: 'wrap' }}>
      {present.map((p) => (
        <span key={p} style={{ color: tokens.color.subtle, fontFamily: tokens.mono, fontSize: 12 }}>
          {p}:{counts[p]}
        </span>
      ))}
    </span>
  );
}

/** Subtle warning chip for students who are overdue / never contacted. */
function OverdueChip({ neverContacted }: { neverContacted: boolean }) {
  return (
    <span
      style={{
        ...chipStyle(false),
        color: tokens.color.danger,
        borderColor: tokens.color.danger,
        cursor: 'default',
      }}
    >
      {neverContacted ? 'never contacted' : 'overdue'}
    </span>
  );
}

/**
 * Presentational student-trajectory dashboard. Renders the (pre-sorted, most
 * needy first) trajectories as an accessible table: who was last contacted, how
 * many pieces of feedback, a compact per-grading-period arc, the strength/growth
 * balance, and a "View history" link. Overdue / never-contacted students are
 * visually flagged. No data loading happens here.
 */
export function StudentTrajectoryView({
  trajectories,
  yearId,
  courseId,
  periodId,
}: StudentTrajectoryViewProps) {
  if (trajectories.length === 0) {
    return <p style={{ color: tokens.color.muted }}>No students in this roster yet.</p>;
  }

  const th: CSSProperties = {
    textAlign: 'left',
    fontSize: 13,
    fontWeight: 600,
    color: tokens.color.muted,
    padding: `${tokens.space(1)}px ${tokens.space(1)}px`,
    borderBottom: `1px solid ${tokens.color.border}`,
  };
  const td: CSSProperties = {
    fontSize: 14,
    color: tokens.color.text,
    padding: `${tokens.space(1)}px ${tokens.space(1)}px`,
    borderBottom: `1px solid ${tokens.color.border}`,
    verticalAlign: 'top',
  };

  return (
    <section role="region" aria-label="Student trajectories" style={cardStyle()}>
      <h2 style={{ fontSize: 15, marginTop: 0 }}>Student trajectories</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <caption style={{ textAlign: 'left', color: tokens.color.muted, fontSize: 13, marginBottom: tokens.space(1) }}>
            Most-needy first — uncontacted students lead, then longest since last contact.
          </caption>
          <thead>
            <tr>
              <th style={th} scope="col">Student</th>
              <th style={th} scope="col">Last contacted</th>
              <th style={th} scope="col">Feedback</th>
              <th style={th} scope="col">By grading period</th>
              <th style={th} scope="col">Strength / growth</th>
              <th style={th} scope="col">History</th>
            </tr>
          </thead>
          <tbody>
            {trajectories.map((t) => {
              const neverContacted = t.lastSentAt === null;
              return (
                <tr key={t.studentId} data-overdue={t.overdue ? 'true' : 'false'}>
                  <th
                    scope="row"
                    style={{ ...td, fontWeight: 600 }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: tokens.space(1), flexWrap: 'wrap' }}>
                      {t.name}
                      {t.overdue && <OverdueChip neverContacted={neverContacted} />}
                    </span>
                  </th>
                  <td style={td}>
                    {neverContacted ? (
                      <span style={{ color: tokens.color.danger }}>never</span>
                    ) : (
                      <span
                        aria-label={`Last contacted ${t.daysSinceLast} days ago`}
                        title={`${t.daysSinceLast} days ago`}
                      >
                        {formatHistoryDate(t.lastSentAt as number)}
                      </span>
                    )}
                  </td>
                  <td style={td}>{t.total}</td>
                  <td style={td}>
                    <GradingPeriodArc counts={t.countsByGradingPeriod} />
                  </td>
                  <td style={td}>
                    <span
                      aria-label={`${t.strengthCount} strength, ${t.growthCount} growth`}
                    >
                      <span style={{ color: tokens.color.teal }}>{t.strengthCount}</span>
                      {' / '}
                      <span style={{ color: tokens.color.subtle }}>{t.growthCount}</span>
                    </span>
                  </td>
                  <td style={td}>
                    <Link
                      to={historyHref(t.studentId, yearId, courseId, periodId)}
                      style={{ color: tokens.color.teal }}
                    >
                      View history
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
