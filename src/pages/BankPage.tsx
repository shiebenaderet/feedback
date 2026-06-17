import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { NavBar } from '../components/NavBar';
import { BankList } from '../bank/BankList';
import { BankEntryForm } from '../bank/BankEntryForm';
import { addBankEntry } from '../bank/bankRepo';
import { ensureSeedBank } from '../bank/ensureSeedBank';
import type { BankEntry, BankEntryInput } from '../bank/types';
import { tokens } from '../ui/theme';

/** Data access is injectable so the page smoke-tests without a backend.
 *  Structural call signatures (db: unknown) so vi.fn mocks satisfy them. */
export interface BankPageDeps {
  uid: string;
  listBankEntries: (db: unknown, uid: string) => Promise<BankEntry[]>;
  addBankEntry: (db: unknown, uid: string, input: BankEntryInput) => Promise<string>;
}

/**
 * The shared comment bank: one library of tagged comment templates used across
 * every course and period. Teachers browse/search/filter existing comments and
 * add new ones. (Standards-based comments slot in here later via the `standard`
 * tag — the taxonomy already reserves it.)
 */
export function BankPage({ deps }: { deps?: Partial<BankPageDeps> }) {
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const api = {
    listBankEntries:
      deps?.listBankEntries ?? (ensureSeedBank as BankPageDeps['listBankEntries']),
    addBankEntry: deps?.addBankEntry ?? addBankEntry,
  };

  const [entries, setEntries] = useState<BankEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    if (!uid) return;
    api
      .listBankEntries(db, uid)
      .then(setEntries)
      .catch(() => setError('Could not load the comment bank.'));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function handleSave(input: BankEntryInput) {
    setError(null);
    try {
      await api.addBankEntry(db, uid, input);
      reload();
    } catch {
      setError('Could not save the comment.');
    }
  }

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 980, margin: '0 auto', padding: tokens.space(4) }}>
        <h1 style={{ fontSize: 28, letterSpacing: '-0.01em' }}>Comment bank</h1>
        <p style={{ color: tokens.color.muted }}>
          One shared library of comment templates, reused across every course and period.
        </p>
        {error && <p role="alert">{error}</p>}

        <section style={{ marginTop: tokens.space(3) }} aria-label="Add a comment">
          <h2 style={{ fontSize: 18 }}>Add a comment</h2>
          <BankEntryForm onSave={handleSave} />
        </section>

        <section style={{ marginTop: tokens.space(3) }} aria-label="Comment list">
          <h2 style={{ fontSize: 18 }}>Your comments</h2>
          <BankList entries={entries} />
        </section>
      </main>
    </>
  );
}
