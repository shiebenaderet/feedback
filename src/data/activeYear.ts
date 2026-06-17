import type { Firestore } from 'firebase/firestore';
import { getOrCreateCurrentYear, listYears } from './years';
import { currentSchoolYearLabel } from './currentSchoolYearLabel';
import { listCourses } from './courses';

const STORAGE_KEY = 'feedback.activeYearId';

/** Read the persisted active year id for this teacher (or null). */
export function readStoredYearId(uid: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_KEY}.${uid}`);
  } catch {
    return null;
  }
}

/** Persist the active year id so every page resolves the SAME year. */
export function storeYearId(uid: string, yearId: string): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}.${uid}`, yearId);
  } catch {
    /* localStorage unavailable (private mode) — non-fatal */
  }
}

export interface ResolveActiveYearDeps {
  getOrCreateCurrentYear: typeof getOrCreateCurrentYear;
  listYears: typeof listYears;
  listCourses: typeof listCourses;
  readStoredYearId: typeof readStoredYearId;
  storeYearId: typeof storeYearId;
}

const defaultDeps: ResolveActiveYearDeps = {
  getOrCreateCurrentYear,
  listYears,
  listCourses,
  readStoredYearId,
  storeYearId,
};

/**
 * The SINGLE active-year resolver every page uses, so Home, Setup, Roster, and
 * Compose always agree on which year is in view — even across the August
 * rollover. Resolution order:
 *   1. A previously-stored active year (the teacher's last working year), if it
 *      still has courses.
 *   2. The clock-derived current year, if it has courses (or is brand new).
 *   3. The most recent OTHER year that has courses (rollover fallback).
 * The chosen id is persisted so subsequent pages and reloads stay consistent.
 */
export async function resolveActiveYear(
  db: Firestore,
  uid: string,
  deps: ResolveActiveYearDeps = defaultDeps,
): Promise<string> {
  const courseCount = async (yearId: string): Promise<number> => {
    try {
      const cs = await deps.listCourses(db, uid, yearId, undefined, { includeArchived: true });
      return cs.length;
    } catch {
      return 0;
    }
  };

  // 1. Honor the stored working year ONLY if it still has courses. A stale
  //    pointer (e.g. to an empty duplicate year from earlier) is ignored.
  const stored = deps.readStoredYearId(uid);
  if (stored && (await courseCount(stored)) > 0) return stored;

  // Ensure the current clock-year doc exists (creates it if brand new).
  const currentId = await deps.getOrCreateCurrentYear(db, uid, currentSchoolYearLabel());

  // 2. Pick the year that ACTUALLY HAS THE MOST COURSES. This is robust against
  //    duplicate year docs (same label, different ids) where the courses live in
  //    one and the clock-resolver returns another empty one — we always land on
  //    the populated year, never a blank duplicate. Ties go to the current year,
  //    then to the most recent label.
  const years = await deps.listYears(db, uid); // newest-label-first
  let best: { id: string; count: number } | null = null;
  for (const y of years) {
    const count = await courseCount(y.id);
    if (count === 0) continue;
    const isBetter =
      best === null ||
      count > best.count ||
      (count === best.count && y.id === currentId);
    if (isBetter) best = { id: y.id, count };
  }
  if (best) {
    deps.storeYearId(uid, best.id);
    return best.id;
  }

  // 3. Nothing populated anywhere (fresh teacher) — use the current year.
  deps.storeYearId(uid, currentId);
  return currentId;
}
