import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { listBankEntries } from './bankRepo';
import { SEED_BANK as RAW_SEED_BANK } from './seedBank';
import type { BankEntry } from './types';

// seedBank.ts types entries with the all-optional src/types BankTags; the bank
// repo uses the stricter bank-local BankEntry. The runtime shape is identical,
// so present the seed bank as bank-local entries.
const SEED_BANK = RAW_SEED_BANK as unknown as BankEntry[];

/** Writes one seed entry AT ITS FIXED id (idempotent — re-running overwrites, never duplicates). */
async function defaultWriteSeedEntry(db: Firestore, uid: string, e: BankEntry): Promise<void> {
  const { id, ...input } = e;
  await setDoc(doc(db, 'teachers', uid, 'bankEntries', id), input);
}

export interface EnsureSeedBankDeps {
  listBankEntries: (db: Firestore, uid: string) => Promise<BankEntry[]>;
  writeSeedEntry: (db: Firestore, uid: string, e: BankEntry) => Promise<void>;
}

const defaultDeps: EnsureSeedBankDeps = {
  listBankEntries,
  writeSeedEntry: defaultWriteSeedEntry,
};

/**
 * Guarantees the teacher's comment bank is non-empty: on the very first read
 * (empty bank) it installs the curated SEED_BANK at fixed ids and returns it,
 * so the compose screen and Bank page always have comments to start from.
 * Idempotent — once entries exist (seed or teacher-added), it just returns them.
 */
export async function ensureSeedBank(
  db: Firestore,
  uid: string,
  deps: EnsureSeedBankDeps = defaultDeps,
): Promise<BankEntry[]> {
  const existing = await deps.listBankEntries(db, uid);
  if (existing.length > 0) return existing;

  for (const e of SEED_BANK) {
    await deps.writeSeedEntry(db, uid, e);
  }
  return SEED_BANK;
}
