/**
 * The current academic-year label, e.g. "2025–26" (en-dash). The school year
 * rolls over in August: August (month index 7) onward belongs to the year that
 * starts now; before that it belongs to the year that started the prior August.
 *
 * This is the SINGLE source of truth for the year label — every page that
 * resolves the active year (Setup, Home, Roster, Compose) imports it, so they
 * always read/write the same `years/{id}` document. A divergent label here
 * would silently partition a teacher's data across two year documents.
 *
 * `now` is injectable for deterministic tests; it defaults to the real clock.
 */
export function currentSchoolYearLabel(now: Date = new Date()): string {
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const endTwo = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}–${endTwo}`;
}
