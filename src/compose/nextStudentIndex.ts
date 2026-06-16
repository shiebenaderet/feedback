// src/compose/nextStudentIndex.ts

/**
 * "Save & next" advance: move to the next student, clamped at the last index.
 * Returns 0 for an empty roster. Pure so the compose screen's advance logic is testable.
 */
export function nextStudentIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  const last = total - 1;
  if (current >= last) return last;
  return current + 1;
}
