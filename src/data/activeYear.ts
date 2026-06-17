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
  const hasCourses = async (yearId: string): Promise<boolean> => {
    const cs = await deps.listCourses(db, uid, yearId, undefined, { includeArchived: true });
    return cs.length > 0;
  };

  // 1. Honor the stored working year if it still has courses.
  const stored = deps.readStoredYearId(uid);
  if (stored && (await hasCourses(stored))) return stored;

  // 2. The current (clock) year — fine if it has courses or is genuinely new.
  const currentId = await deps.getOrCreateCurrentYear(db, uid, currentSchoolYearLabel());
  if (await hasCourses(currentId)) {
    deps.storeYearId(uid, currentId);
    return currentId;
  }

  // 3. Rollover fallback: the most recent OTHER year that has courses.
  const years = await deps.listYears(db, uid);
  for (const y of years) {
    if (y.id === currentId) continue;
    if (await hasCourses(y.id)) {
      deps.storeYearId(uid, y.id);
      return y.id;
    }
  }

  // Nothing populated anywhere — use (and remember) the current year.
  deps.storeYearId(uid, currentId);
  return currentId;
}
