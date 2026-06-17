import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { NavBar } from '../components/NavBar';
import { listPeriodHistory, listCourseHistory } from '../data/listPeriodHistory';
import { listBankEntries } from '../bank/bankRepo';
import { aggregateTrends, type TrendsSummary } from '../feedback/aggregateTrends';
import { TrendsView } from '../components/TrendsView';
import type { BankEntry, FeedbackHistoryEntry } from '../types';
import { tokens } from '../ui/theme';

/** Structural signatures (db: unknown) so vi.fn mocks satisfy the deps. */
export interface TrendsPageDeps {
  uid: string;
  listPeriodHistory: (db: unknown, uid: string, periodId: string) => Promise<FeedbackHistoryEntry[]>;
  listCourseHistory: (db: unknown, uid: string, courseId: string) => Promise<FeedbackHistoryEntry[]>;
  /** Bank read (named listBank here for call-site symmetry; defaults to listBankEntries). */
  listBank: (db: unknown, uid: string) => Promise<BankEntry[]>;
}

/**
 * Trends for one period (default) or a whole course (scope="course"). Loads the
 * matching history via a collection-group read plus the bank, aggregates with
 * the pure aggregateTrends, and renders TrendsView. Data fns are injected so the
 * page smoke-tests without Firebase.
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
  };

  const [summary, setSummary] = useState<TrendsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const loadHistory =
      scope === 'course'
        ? api.listCourseHistory(db, uid, courseId)
        : api.listPeriodHistory(db, uid, periodId);
    Promise.all([loadHistory, api.listBank(db, uid)])
      .then(([entries, bank]) => {
        if (alive) setSummary(aggregateTrends(entries, bank));
      })
      .catch(() => alive && setError('Could not load trends.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, scope, courseId, periodId]);

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 820, margin: '0 auto', padding: tokens.space(4) }}>
        <h1>{scope === 'course' ? 'Course trends' : 'Period trends'}</h1>
        {error && <p role="alert">{error}</p>}
        {summary && <TrendsView summary={summary} />}
      </main>
    </>
  );
}
