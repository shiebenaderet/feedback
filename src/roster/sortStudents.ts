// src/roster/sortStudents.ts

export type SortDir = 'asc' | 'desc';

/** Anything with a display name; works for ParsedStudent and Firestore-loaded students. */
interface HasName {
  name: string;
}

/**
 * Return a new array sorted by `name` using locale-aware, case-insensitive comparison.
 * Pure: the input array is not mutated.
 */
export function sortStudentsByName<T extends HasName>(students: T[], dir: SortDir = 'asc'): T[] {
  const factor = dir === 'desc' ? -1 : 1;
  return [...students].sort(
    (a, b) => factor * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}
