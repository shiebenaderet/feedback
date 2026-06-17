import type { Firestore } from 'firebase/firestore';
import type { ClassMeta, BankEntry } from '../types';
import type { RosterStudent } from '../roster/RosterTable';
import { listClasses } from '../data/listClasses';
import { listStudents } from '../data/listStudents';
import { listBankEntries } from '../bank/bankRepo';

export interface ComposeData {
  classMeta: ClassMeta;
  students: RosterStudent[];
  entries: BankEntry[];
}

export interface LoadComposeDeps {
  listClasses: typeof listClasses;
  listStudents: typeof listStudents;
  // Structural signature (not `typeof listBankEntries`) so both the real
  // bank-repo (bank-local BankEntry ⊆ canonical) and test mocks satisfy it.
  listBankEntries: (db: Firestore, uid: string) => Promise<BankEntry[]>;
}
const defaultDeps: LoadComposeDeps = {
  listClasses,
  listStudents,
  // bank-local BankEntry is structurally assignable to canonical BankEntry.
  listBankEntries: listBankEntries as LoadComposeDeps['listBankEntries'],
};

/**
 * Loads everything ComposePage needs in one shot. There is no getClass(); we
 * resolve the ClassMeta by id from listClasses (the roster does the same).
 * Bank entries from bankRepo are structurally the canonical BankEntry
 * (tags optional ⊇ bank tags), so they flow straight into ComposeScreen.
 */
export async function loadComposeData(
  db: Firestore,
  uid: string,
  classId: string,
  deps: LoadComposeDeps = defaultDeps,
): Promise<ComposeData> {
  const [classes, students, entries] = await Promise.all([
    deps.listClasses(db, uid, undefined, { includeArchived: true }),
    deps.listStudents(db, uid, classId),
    deps.listBankEntries(db, uid),
  ]);
  const classMeta = classes.find((c) => c.id === classId);
  if (!classMeta) throw new Error(`Class not found: ${classId}`);
  return { classMeta, students, entries: entries as BankEntry[] };
}
