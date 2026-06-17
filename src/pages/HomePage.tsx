import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import type { Firestore } from 'firebase/firestore';
import { getOrCreateCurrentYear } from '../data/years';
import { currentSchoolYearLabel } from '../data/currentSchoolYearLabel';
import { listCourses } from '../data/courses';
import { listPeriods } from '../data/periods';
import { rosterSize } from '../data/students';
import { listFeedbackHistory } from '../data/listFeedbackHistory';
import { periodFeedbackProgress } from '../feedback/periodFeedbackProgress';
import { GRADING_PERIODS } from '../feedback/taxonomy';
import { NavBar } from '../components/NavBar';
import type { Course, Period, FeedbackHistoryEntry } from '../types';
import { tokens, panelStyle, cardStyle, progressTrackStyle, progressFillStyle } from '../ui/theme';

/** Default grading period for Home's progress when none is chosen (last in list = EOY). */
const DEFAULT_GRADING_PERIOD = GRADING_PERIODS[GRADING_PERIODS.length - 1];

/** A period row already resolved with its progress count, ready to render. */
interface PeriodRow extends Period {
  done: number;
  total: number;
}
interface CourseCard {
  course: Course;
  periods: PeriodRow[];
}

/** Data deps are injectable so the smoke test drives Home without a backend.
 *  Structural call signatures (not `typeof`) so vi.fn mocks satisfy them. */
export interface HomePageDeps {
  uid: string;
  yearId: string;
  gradingPeriod: string;
  listCourses: (
    db: Firestore,
    uid: string,
    yearId: string,
    deps?: unknown,
    options?: { includeArchived?: boolean },
  ) => Promise<Course[]>;
  listPeriods: (db: Firestore, uid: string, yearId: string, courseId: string) => Promise<Period[]>;
  rosterSize: (
    db: Firestore,
    uid: string,
    yearId: string,
    courseId: string,
    periodId: string,
  ) => Promise<number>;
  listFeedbackHistory: (
    db: Firestore,
    uid: string,
    scope: { yearId: string; courseId?: string; periodId?: string; studentId?: string },
  ) => Promise<FeedbackHistoryEntry[]>;
}

export default function HomePage({ deps }: { deps?: Partial<HomePageDeps> }) {
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const gradingPeriod = deps?.gradingPeriod ?? DEFAULT_GRADING_PERIOD;
  const api = {
    listCourses: deps?.listCourses ?? listCourses,
    listPeriods: deps?.listPeriods ?? listPeriods,
    rosterSize: deps?.rosterSize ?? rosterSize,
    listFeedbackHistory: deps?.listFeedbackHistory ?? listFeedbackHistory,
  };

  const [yearId, setYearId] = useState<string>(deps?.yearId ?? '');
  const [cards, setCards] = useState<CourseCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || yearId) return;
    getOrCreateCurrentYear(db, uid, currentSchoolYearLabel())
      .then((id) => setYearId(id))
      .catch(() => setError('Could not load the current year.'));
  }, [uid, yearId]);

  useEffect(() => {
    if (!uid || !yearId) return;
    let cancelled = false;
    (async () => {
      try {
        const courses = await api.listCourses(db, uid, yearId, undefined, {
          includeArchived: false,
        });
        const built = await Promise.all(
          courses.map(async (course) => {
            const periods = await api.listPeriods(db, uid, yearId, course.id);
            const rows = await Promise.all(
              periods.map(async (p) => {
                const total = await api.rosterSize(db, uid, yearId, course.id, p.id);
                // The history read is a collection-group query that needs a
                // composite index; if it isn't ready (or errors), the dashboard
                // must still render — degrade this period's progress to 0 done.
                let history: FeedbackHistoryEntry[] = [];
                try {
                  history = await api.listFeedbackHistory(db, uid, {
                    yearId,
                    courseId: course.id,
                    periodId: p.id,
                  });
                } catch {
                  history = [];
                }
                const { done } = periodFeedbackProgress(total, history, gradingPeriod);
                return { ...p, done, total };
              }),
            );
            return { course, periods: rows };
          }),
        );
        if (!cancelled) setCards(built);
      } catch {
        if (!cancelled) setError('Could not load your courses.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, yearId, gradingPeriod]);

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 980, margin: '0 auto', padding: tokens.space(4) }}>
        <h1 style={{ fontSize: 28, letterSpacing: '-0.01em' }}>Welcome back</h1>
        <p style={{ color: tokens.color.muted }}>Signed in as {user?.email}</p>
        {error && <p role="alert">{error}</p>}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: tokens.space(2),
            marginTop: tokens.space(2),
          }}
        >
          {cards.map(({ course, periods }) => (
            <section key={course.id} style={cardStyle()} aria-label={course.name}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>{course.name}</h2>

              {periods.length === 0 ? (
                <p style={{ color: tokens.color.muted, fontSize: 14 }}>
                  No periods yet.{' '}
                  <Link to="/setup" style={{ color: tokens.color.teal }}>
                    Add periods
                  </Link>
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: tokens.space(1.5) }}>
                  {periods.map((p) => (
                    <li key={p.id} style={{ display: 'grid', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space(1) }}>
                        <span style={{ flex: 1, fontWeight: 600 }}>{p.label}</span>
                        <span
                          style={{ color: tokens.color.muted, fontVariantNumeric: 'tabular-nums' }}
                        >
                          {p.done} / {p.total}
                        </span>
                      </div>
                      {p.total > 0 && (
                        <div
                          role="progressbar"
                          aria-label={`${p.label} feedback progress`}
                          aria-valuenow={p.done}
                          aria-valuemin={0}
                          aria-valuemax={p.total}
                          style={progressTrackStyle()}
                        >
                          <div
                            style={progressFillStyle(
                              p.total > 0 ? Math.round((p.done / p.total) * 100) : 0,
                            )}
                          />
                        </div>
                      )}
                      {p.total === 0 ? (
                        // Empty roster: adding students is the only sensible next step.
                        <Link
                          to={`/course/${course.id}/period/${p.id}/roster`}
                          style={{ color: tokens.color.teal, fontWeight: 600 }}
                        >
                          + Add students
                        </Link>
                      ) : (
                        <div style={{ display: 'flex', gap: tokens.space(1.5), fontSize: 14 }}>
                          <Link
                            to={`/course/${course.id}/period/${p.id}/roster`}
                            style={{ color: tokens.color.teal }}
                          >
                            Roster
                          </Link>
                          <Link
                            to={`/course/${course.id}/period/${p.id}/compose`}
                            style={{ color: tokens.color.teal }}
                          >
                            Write feedback
                          </Link>
                          <Link
                            to={`/course/${course.id}/period/${p.id}/trends`}
                            style={{ color: tokens.color.teal }}
                          >
                            Trends
                          </Link>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <Link
            to="/setup"
            style={{
              ...panelStyle(),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: tokens.color.teal,
              fontWeight: 600,
              textDecoration: 'none',
              minHeight: 96,
            }}
          >
            + Add course
          </Link>
        </div>
      </main>
    </>
  );
}
