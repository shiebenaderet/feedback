// src/compose/nextStudentIndex.ts

/**
 * "Save & next" advance: move to the next student who is NOT yet done, so the
 * teacher isn't sent back to students they've already finished. Falls back to
 * clamping at the last index when every remaining student is done (never loops
 * forever, never crashes on an empty roster).
 *
 * `doneIndices` is the set of roster positions already marked done. Pure so the
 * compose screen's advance logic is testable.
 *
 * Returns 0 for an empty roster.
 */
export function nextStudentIndex(
  current: number,
  total: number,
  doneIndices?: Iterable<number> | null,
): number {
  if (total <= 0) return 0;
  const last = total - 1;

  const done = doneIndices instanceof Set ? doneIndices : new Set(doneIndices ?? []);

  // Scan forward for the first not-done student after `current`.
  for (let i = Math.max(0, current) + 1; i <= last; i++) {
    if (!done.has(i)) return i;
  }

  // Nothing not-done ahead → clamp at the last index (don't wrap, don't crash).
  return last;
}
