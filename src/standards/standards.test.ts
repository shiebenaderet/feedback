import { describe, it, expect } from 'vitest';
import {
  STANDARDS,
  standardByCode,
  componentByCode,
  standardsByStrand,
  components,
  courseComponents,
  labelForCode,
  isKnownStandard,
} from './standards';

describe('standards data', () => {
  it('has all five strands represented', () => {
    const strands = new Set(STANDARDS.map((s) => s.strand));
    expect(strands).toEqual(
      new Set(['civics', 'economics', 'geography', 'history', 'skills']),
    );
  });

  it('every strand code is unique and every component code is unique', () => {
    const codes = STANDARDS.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    const compCodes = STANDARDS.flatMap((s) => s.components.map((c) => c.code));
    expect(new Set(compCodes).size).toBe(compCodes.length);
  });

  it('every component has a non-empty code, grade, and text', () => {
    for (const s of STANDARDS) {
      for (const c of s.components) {
        expect(c.code.length).toBeGreaterThan(0);
        expect(['6', '7', '8', 'all']).toContain(c.grade);
        expect(c.text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('the Skills strand components are all grade "all"', () => {
    for (const s of standardsByStrand('skills')) {
      for (const c of s.components) expect(c.grade).toBe('all');
    }
  });
});

describe('standards lookups', () => {
  it('standardByCode resolves both a strand code and a component code', () => {
    expect(standardByCode('C1')?.code).toBe('C1');
    expect(standardByCode('C1.6-8.3')?.code).toBe('C1');
    expect(standardByCode('SSS4.6-8.1')?.strand).toBe('skills');
    expect(standardByCode('nope')).toBeUndefined();
  });

  it('componentByCode returns the exact component', () => {
    expect(componentByCode('SSS1.6-8.2')?.text).toMatch(/logic of reasons/);
    expect(componentByCode('missing')).toBeUndefined();
  });

  it('components(grade) includes the grade plus all-grades Skills', () => {
    const g8 = components('8');
    expect(g8.every((c) => c.grade === '8' || c.grade === 'all')).toBe(true);
    // Skills (grade 'all') should be present in the grade-8 course view.
    expect(g8.some((c) => c.code.startsWith('SSS'))).toBe(true);
    // A grade-6-only component should NOT appear in the grade-8 view.
    expect(g8.some((c) => c.code === 'C1.6-8.1')).toBe(false);
  });

  it('courseComponents returns grade-8 + skills', () => {
    const course = courseComponents();
    expect(course.some((c) => c.code === 'C1.6-8.3')).toBe(true); // grade 8
    expect(course.some((c) => c.code === 'SSS3.6-8.1')).toBe(true); // skills
    expect(course.some((c) => c.code === 'C1.6-8.1')).toBe(false); // grade 6
  });

  it('labelForCode produces a code-prefixed, truncated label', () => {
    const label = labelForCode('C1.6-8.3', 30);
    expect(label.startsWith('C1.6-8.3 — ')).toBe(true);
    expect(label.endsWith('…')).toBe(true);
  });

  it('isKnownStandard recognizes strand and component codes', () => {
    expect(isKnownStandard('H2')).toBe(true);
    expect(isKnownStandard('H2.6-8.5')).toBe(true);
    expect(isKnownStandard('ZZ9')).toBe(false);
  });
});
