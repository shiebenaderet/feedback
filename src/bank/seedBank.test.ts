// src/bank/seedBank.test.ts
import { describe, it, expect } from 'vitest';
import { SEED_BANK, seedKeyOf } from './seedBank';
import { extractSlots } from './extractSlots'; // (key, kind) extractor from Task K1

describe('seed comment bank', () => {
  it('ships a meaningful number of entries', () => {
    expect(SEED_BANK.length).toBeGreaterThanOrEqual(15);
  });

  it('covers the original five academic areas and all four types', () => {
    const areas = new Set(SEED_BANK.map((e) => e.tags.area));
    const types = new Set(SEED_BANK.map((e) => e.tags.type));
    // The original slot-based set's areas remain present...
    for (const a of ['cer', 'discussion', 'research', 'collaboration', 'professionalism']) {
      expect(areas.has(a), `area ${a}`).toBe(true);
    }
    // ...plus the generic comment areas.
    for (const a of ['contribution', 'attitude', 'questions', 'perseverance']) {
      expect(areas.has(a), `generic area ${a}`).toBe(true);
    }
    expect(types).toEqual(new Set(['success', 'growth', 'behavior', 'skill']));
  });

  it('ships 30 generic, slot-free comments tagged success or growth', () => {
    const generic = SEED_BANK.filter((e) => e.id.startsWith('gen-'));
    expect(generic.length).toBe(30);
    for (const e of generic) {
      expect(e.slots.length, `${e.id} should be slot-free`).toBe(0);
      expect(['success', 'growth']).toContain(e.tags.type);
    }
  });

  it('every entry declares slots that exactly match the tokens in its templateText', () => {
    for (const e of SEED_BANK) {
      const tokenKeys = extractSlots(e.templateText).map((s) => s.key).sort();
      const declaredKeys = e.slots.map((s) => s.key).sort();
      expect(declaredKeys).toEqual(tokenKeys);
    }
  });

  it('uses {name} (auto) and at least one {fill} token in Mr. B. voice', () => {
    const cer = SEED_BANK.find((e) => e.id === 'seed-cer-success-1')!;
    expect(cer.templateText).toContain('{name}');
    expect(cer.slots.some((s) => s.kind === 'fill')).toBe(true);
    // first-person voice
    expect(cer.templateText.toLowerCase()).toMatch(/\bi (was|noticed|loved|saw)\b/);
  });

  it('seedKeyOf is stable and unique per entry (for idempotent install)', () => {
    const keys = SEED_BANK.map(seedKeyOf);
    expect(new Set(keys).size).toBe(SEED_BANK.length);
    expect(seedKeyOf(SEED_BANK[0])).toBe(SEED_BANK[0].id);
  });
});
