import type { Firestore } from 'firebase/firestore';
import type { BankEntry, Period } from '../types';
import type { RosterStudent } from '../roster/RosterTable';
import { listPeriods } from '../data/periods';
import { listStudents } from '../data/students';
import { listBankEntries } from '../bank/bankRepo';

export interface ComposeTarget {
  yearId: string;
  courseId: string;
  periodId: string;
}

export interface ComposeData {
  period: Period;
  courseId: string;
  yearId: string;
  students: RosterStudent[];
  entries: BankEntry[];
}

export interface LoadComposeDeps {
  listPeriods: typeof listPeriods;
  listStudents: typeof listStudents;
  // Structural signature so both the real bank-repo (bank-local BankEntry ⊆
  // canonical) and test mocks satisfy it.
  listBankEntries: (db: Firestore, uid: string) => Promise<BankEntry[]>;
}

const defaultDeps: LoadComposeDeps = {
  listPeriods,
  listStudents,
  listBankEntries: listBankEntries as LoadComposeDeps['listBankEntries'],
};

/**
 * Loads everything ComposePage needs for ONE period in one shot. Resolves the
 * Period (and its denormalized yearId) from listPeriods, the roster from the
 * nested period path, and the one shared bank. Bank entries from bankRepo are
 * structurally the canonical BankEntry, so they flow straight into ComposeScreen.
 */
export async function loadComposeData(
  db: Firestore,
  uid: string,
  target: ComposeTarget,
  deps: LoadComposeDeps = defaultDeps,
): Promise<ComposeData> {
  const { yearId, courseId, periodId } = target;
  const [periods, students, entries] = await Promise.all([
    deps.listPeriods(db, uid, yearId, courseId),
    deps.listStudents(db, uid, yearId, courseId, periodId),
    deps.listBankEntries(db, uid),
  ]);
  const period = periods.find((p) => p.id === periodId);
  if (!period) throw new Error(`Period not found: ${periodId}`);
  return {
    period,
    courseId,
    yearId,
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      period: s.period ?? '',
    })),
    entries: entries as BankEntry[],
  };
}
