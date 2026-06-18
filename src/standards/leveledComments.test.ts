import { describe, it, expect } from 'vitest';
import { courseComponents, isKnownStandard } from './standards';
import {
  LEVELED_COMMENTS,
  commentsForStandard,
  leveledComment,
  type Proficiency,
} from './leveledComments';

const LEVELS: Proficiency[] = [4, 3, 2, 1];

describe('leveled comments data integrity', () => {
  it('every entry uses a known, course-relevant standard code', () => {
    const courseCodes = new Set(courseComponents().map((c) => c.code));
    for (const c of LEVELED_COMMENTS) {
      expect(isKnownStandard(c.standardCode)).toBe(true);
      expect(courseCodes.has(c.standardCode)).toBe(true);
    }
  });

  it('every course component has exactly one entry per level (4,3,2,1)', () => {
    const course = courseComponents();
    for (const comp of course) {
      const entries = LEVELED_COMMENTS.filter(
        (c) => c.standardCode === comp.code,
      );
      const byLevel = entries.map((e) => e.level).sort();
      expect(byLevel, `levels for ${comp.code}`).toEqual([1, 2, 3, 4]);
    }
  });

  it('has no entries for codes outside the course components', () => {
    const courseCodes = new Set(courseComponents().map((c) => c.code));
    const stray = LEVELED_COMMENTS.filter(
      (c) => !courseCodes.has(c.standardCode),
    );
    expect(stray).toEqual([]);
  });

  it('has exactly 4 entries per course component and no duplicates', () => {
    const course = courseComponents();
    expect(LEVELED_COMMENTS.length).toBe(course.length * 4);
    const keys = LEVELED_COMMENTS.map((c) => `${c.standardCode}|${c.level}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every level 1/2/3 entry has a non-empty nextStep', () => {
    for (const c of LEVELED_COMMENTS) {
      if (c.level !== 4) {
        expect(c.nextStep, `${c.standardCode} L${c.level}`).toBeTruthy();
        expect((c.nextStep ?? '').trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('every text starts with {name} and is a non-trivial length', () => {
    for (const c of LEVELED_COMMENTS) {
      expect(c.text.startsWith('{name}')).toBe(true);
      expect(c.text.length, `${c.standardCode} L${c.level}`).toBeGreaterThan(40);
    }
  });

  it('uses only the {name} token (no other {tokens})', () => {
    const tokenRe = /\{([^}]*)\}/g;
    for (const c of LEVELED_COMMENTS) {
      const fields = [c.text, c.nextStep ?? ''];
      for (const f of fields) {
        let m: RegExpExecArray | null;
        while ((m = tokenRe.exec(f)) !== null) {
          expect(m[1]).toBe('name');
        }
      }
    }
  });
});

describe('leveled comments helpers', () => {
  it('commentsForStandard returns 4 entries sorted 4 → 1', () => {
    const got = commentsForStandard('SSS2.6-8.2');
    expect(got.length).toBe(4);
    expect(got.map((c) => c.level)).toEqual([4, 3, 2, 1]);
    expect(got.every((c) => c.standardCode === 'SSS2.6-8.2')).toBe(true);
  });

  it('commentsForStandard returns empty for an unknown code', () => {
    expect(commentsForStandard('ZZ9.0-0.0')).toEqual([]);
  });

  it('leveledComment finds a specific entry', () => {
    const one = leveledComment('C1.6-8.3', 1);
    expect(one).toBeDefined();
    expect(one?.standardCode).toBe('C1.6-8.3');
    expect(one?.level).toBe(1);
    expect(one?.nextStep).toBeTruthy();
  });

  it('leveledComment returns undefined for a missing combination', () => {
    expect(leveledComment('definitely-not-a-code', 3)).toBeUndefined();
  });

  it('every course component resolves through both helpers at all levels', () => {
    for (const comp of courseComponents()) {
      const all = commentsForStandard(comp.code);
      expect(all.length).toBe(4);
      for (const lvl of LEVELS) {
        expect(leveledComment(comp.code, lvl)).toBeDefined();
      }
    }
  });
});
