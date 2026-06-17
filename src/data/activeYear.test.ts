import { describe, it, expect, vi } from 'vitest';
import { resolveActiveYear } from './activeYear';

function makeDeps(over: Record<string, unknown> = {}) {
  return {
    getOrCreateCurrentYear: vi.fn(async () => 'year-current'),
    listYears: vi.fn(async () => [
      { id: 'year-current', label: '2026–27' },
      { id: 'year-prev', label: '2025–26' },
    ]),
    // default: only the previous year has courses
    listCourses: vi.fn(async (_db: unknown, _uid: string, yearId: string) =>
      yearId === 'year-prev' ? [{ id: 'c1', name: 'History' }] : [],
    ),
    readStoredYearId: vi.fn(() => null),
    storeYearId: vi.fn(),
    ...over,
  };
}

describe('resolveActiveYear', () => {
  it('uses the current year when it has courses', async () => {
    const deps = makeDeps({
      listCourses: vi.fn(async () => [{ id: 'c1', name: 'History' }]),
    });
    const id = await resolveActiveYear({} as never, 'u1', deps as never);
    expect(id).toBe('year-current');
    expect(deps.storeYearId).toHaveBeenCalledWith('u1', 'year-current');
  });

  it('falls back to the most recent prior year with courses when the current year is empty (August rollover)', async () => {
    const deps = makeDeps();
    const id = await resolveActiveYear({} as never, 'u1', deps as never);
    expect(id).toBe('year-prev');
    expect(deps.storeYearId).toHaveBeenCalledWith('u1', 'year-prev');
  });

  it('honors a stored working year that still has courses, without touching the clock', async () => {
    const deps = makeDeps({
      readStoredYearId: vi.fn(() => 'year-prev'),
    });
    const id = await resolveActiveYear({} as never, 'u1', deps as never);
    expect(id).toBe('year-prev');
    // Stored year short-circuits — no need to create/resolve the clock year.
    expect(deps.getOrCreateCurrentYear).not.toHaveBeenCalled();
  });

  it('uses (and stores) the current year when nothing is populated anywhere (fresh teacher)', async () => {
    const deps = makeDeps({
      listYears: vi.fn(async () => [{ id: 'year-current', label: '2026–27' }]),
      listCourses: vi.fn(async () => []),
    });
    const id = await resolveActiveYear({} as never, 'u1', deps as never);
    expect(id).toBe('year-current');
    expect(deps.storeYearId).toHaveBeenCalledWith('u1', 'year-current');
  });

  it('lands on the POPULATED duplicate year, never an empty same-label duplicate', async () => {
    // The exact failure: same label '2025–26' exists twice; the clock resolver
    // returns the EMPTY one (smallest id), but the courses live in the other.
    const deps = makeDeps({
      getOrCreateCurrentYear: vi.fn(async () => 'year-empty-dupe'),
      listYears: vi.fn(async () => [
        { id: 'year-empty-dupe', label: '2025–26' },
        { id: 'year-with-courses', label: '2025–26' },
      ]),
      listCourses: vi.fn(async (_db: unknown, _uid: string, yearId: string) =>
        yearId === 'year-with-courses'
          ? [{ id: 'c1', name: 'History' }, { id: 'c2', name: 'Geo' }]
          : [],
      ),
    });
    const id = await resolveActiveYear({} as never, 'u1', deps as never);
    expect(id).toBe('year-with-courses');
    expect(deps.storeYearId).toHaveBeenCalledWith('u1', 'year-with-courses');
  });

  it('ignores a STALE stored year that no longer has courses', async () => {
    const deps = makeDeps({
      readStoredYearId: vi.fn(() => 'year-empty'),
      listYears: vi.fn(async () => [
        { id: 'year-empty', label: '2025–26' },
        { id: 'year-prev', label: '2025–26' },
      ]),
      listCourses: vi.fn(async (_db: unknown, _uid: string, yearId: string) =>
        yearId === 'year-prev' ? [{ id: 'c1', name: 'History' }] : [],
      ),
    });
    const id = await resolveActiveYear({} as never, 'u1', deps as never);
    // Stale empty stored year is skipped; resolves to the populated one instead.
    expect(id).toBe('year-prev');
  });
});
