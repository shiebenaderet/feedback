import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { NavBar } from '../components/NavBar';
import { listPeriodHistory, listCourseHistory } from '../data/listPeriodHistory';
import { listBankEntries } from '../bank/bankRepo';
import { listStudents } from '../data/students';
import { resolveActiveYear } from '../data/activeYear';
import { aggregateTrends } from '../feedback/aggregateTrends';
import {
  aggregateStudentTrajectories,
  distinctUnits,
} from '../feedback/aggregateStudentTrajectories';
import { TrendsView } from '../components/TrendsView';
import { StudentTrajectoryView } from '../components/StudentTrajectoryView';
import type { BankEntry, FeedbackHistoryEntry, Student } from '../types';
import { tokens } from '../ui/theme';

/** Structural signatures (db: unknown) so vi.fn mocks satisfy the deps. */
export interface TrendsPageDeps {
  uid: string;
  listPeriodHistory: (db: unknown, uid: string, periodId: string) => Promise<FeedbackHistoryEntry[]>;
  listCourseHistory: (db: unknown, uid: string, courseId: string) => Promise<FeedbackHistoryEntry[]>;
  /** Bank read (named listBank here for call-site symmetry; defaults to listBankEntries). */
  listBank: (db: unknown, uid: string) => Promise<BankEntry[]>;
  /** Resolve the active year id (for the roster path + history links). */
  resolveYearId: (db: unknown, uid: string) => Promise<string>;
  /** Period roster read, for the trajectory dashboard (includes never-contacted). */
  listStudents: (
    db: unknown,
    uid: string,
    yearId: string,
    courseId: string,
    periodId: string,
  ) => Promise<Student[]>;
}

/**
 * Trends for one period (default) or a whole course (scope="course"). Loads the
 * matching history via a collection-group read, the bank, and the period roster,
 * then renders the aggregated TrendsView, a year-round StudentTrajectoryView, and
 * a unit filter that slices BOTH. Data fns are injected so the page smoke-tests
 * without Firebase.
 */
export function TrendsPage({
  deps,
  scope = 'period',
}: {
  deps?: Partial<TrendsPageDeps>;
  scope?: 'period' | 'course';
}) {
  const { courseId = '', periodId = '' } = useParams();
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const api = {
    listPeriodHistory:
      deps?.listPeriodHistory ?? (listPeriodHistory as TrendsPageDeps['listPeriodHistory']),
    listCourseHistory:
      deps?.listCourseHistory ?? (listCourseHistory as TrendsPageDeps['listCourseHistory']),
    listBank: deps?.listBank ?? (listBankEntries as TrendsPageDeps['listBank']),
    resolveYearId:
      deps?.resolveYearId ?? ((d: unknown, u: string) => resolveActiveYear(d as never, u)),
    listStudents: deps?.listStudents ?? (listStudents as TrendsPageDeps['listStudents']),
  };

  const [history, setHistory] = useState<FeedbackHistoryEntry[] | null>(null);
  const [bank, setBank] = useState<BankEntry[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [yearId, setYearId] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const loadHistory =
      scope === 'course'
        ? api.listCourseHistory(db, uid, courseId)
        : api.listPeriodHistory(db, uid, periodId);

    // Roster is best-effort: trends still render if the roster read fails.
    const loadRoster = api
      .resolveYearId(db, uid)
      .then(async (year) => {
        if (alive) setYearId(year);
        // Course scope has no single roster; only load for period scope.
        if (scope !== 'period') return [] as Student[];
        return api.listStudents(db, uid, year, courseId, periodId);
      })
      .catch(() => [] as Student[]);

    Promise.all([loadHistory, api.listBank(db, uid), loadRoster])
      .then(([entries, bankEntries, roster]) => {
        if (!alive) return;
        setHistory(entries);
        setBank(bankEntries);
        setStudents(roster);
      })
      .catch(() => alive && setError('Could not load trends.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, scope, courseId, periodId]);

  const units = useMemo(() => distinctUnits(history ?? []), [history]);

  // Reset the unit selection if it no longer exists in the loaded history.
  useEffect(() => {
    if (selectedUnit !== null && !units.includes(selectedUnit)) setSelectedUnit(null);
  }, [units, selectedUnit]);

  // The unit filter narrows the entries before EITHER aggregation runs.
  const filtered = useMemo(() => {
    const all = history ?? [];
    return selectedUnit === null ? all : all.filter((e) => e.unit === selectedUnit);
  }, [history, selectedUnit]);

  const summary = useMemo(() => aggregateTrends(filtered, bank), [filtered, bank]);
  const trajectories = useMemo(
    () => aggregateStudentTrajectories(students, filtered, { bankEntries: bank }),
    [students, filtered, bank],
  );

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 820, margin: '0 auto', padding: tokens.space(4) }}>
        <h1>{scope === 'course' ? 'Course trends' : 'Period trends'}</h1>
        {error && <p role="alert">{error}</p>}
        {history !== null && (
          <div style={{ display: 'grid', gap: tokens.space(4) }}>
            <TrendsView
              summary={summary}
              units={units}
              selectedUnit={selectedUnit}
              onSelectUnit={setSelectedUnit}
            />
            {scope === 'period' && (
              <StudentTrajectoryView
                trajectories={trajectories}
                yearId={yearId}
                courseId={courseId}
                periodId={periodId}
              />
            )}
          </div>
        )}
      </main>
    </>
  );
}
