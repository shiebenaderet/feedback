import { describe, it, expect } from 'vitest';
import { currentSchoolYearLabel } from './currentSchoolYearLabel';

describe('currentSchoolYearLabel', () => {
  it('uses the academic year starting in August (month >= 7)', () => {
    // Sep 2025 → school year 2025–26
    expect(currentSchoolYearLabel(new Date(2025, 8, 1))).toBe('2025–26');
    // Aug 1 2025 is the rollover boundary → still 2025–26
    expect(currentSchoolYearLabel(new Date(2025, 7, 1))).toBe('2025–26');
  });

  it('before August belongs to the year that started the previous August', () => {
    // Jun 2026 → still the 2025–26 school year
    expect(currentSchoolYearLabel(new Date(2026, 5, 16))).toBe('2025–26');
    // Jan 2026 → 2025–26
    expect(currentSchoolYearLabel(new Date(2026, 0, 1))).toBe('2025–26');
  });

  it('pads the trailing two digits across a century boundary', () => {
    // Sep 2099 → 2099–00
    expect(currentSchoolYearLabel(new Date(2099, 8, 1))).toBe('2099–00');
    // Sep 2009 → 2009–10
    expect(currentSchoolYearLabel(new Date(2009, 8, 1))).toBe('2009–10');
  });

  it('uses an en-dash separator', () => {
    expect(currentSchoolYearLabel(new Date(2025, 8, 1))).toContain('–');
  });
});
