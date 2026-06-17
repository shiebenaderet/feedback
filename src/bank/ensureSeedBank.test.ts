import { describe, it, expect, vi } from 'vitest';
import { ensureSeedBank } from './ensureSeedBank';
import { SEED_BANK } from './seedBank';
import type { BankEntry } from './types';

describe('ensureSeedBank', () => {
  it('installs the full seed bank when the teacher has no entries, then returns it', async () => {
    const written: BankEntry[] = [];
    const deps = {
      listBankEntries: vi.fn(async () => [] as BankEntry[]),
      writeSeedEntry: vi.fn(async (_db: unknown, _uid: string, e: BankEntry) => {
        written.push(e);
      }),
    };

    const result = await ensureSeedBank({ __fake: true } as never, 'u1', deps as never);

    // Every seed entry was written exactly once, at its fixed id.
    expect(deps.writeSeedEntry).toHaveBeenCalledTimes(SEED_BANK.length);
    expect(written.map((e) => e.id).sort()).toEqual(SEED_BANK.map((e) => e.id).sort());
    // The returned entries are the seed bank (so the caller can render immediately).
    expect(result).toHaveLength(SEED_BANK.length);
  });

  it('does nothing and returns the existing entries when the bank is already populated', async () => {
    const existing: BankEntry[] = [
      {
        id: 'mine-1',
        templateText: 'Hi {name}',
        slots: [],
        tags: { type: 'success', area: '', objective: '', tone: '' },
      },
    ];
    const deps = {
      listBankEntries: vi.fn(async () => existing),
      writeSeedEntry: vi.fn(async () => {}),
    };

    const result = await ensureSeedBank({ __fake: true } as never, 'u1', deps as never);

    expect(deps.writeSeedEntry).not.toHaveBeenCalled();
    expect(result).toEqual(existing);
  });
});
