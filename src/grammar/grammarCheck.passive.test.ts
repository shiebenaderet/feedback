// src/grammar/grammarCheck.passive.test.ts
import { describe, it, expect } from 'vitest';
import { grammarCheck } from './grammarCheck';

describe('grammarCheck — passive voice heuristic', () => {
  it('flags "was completed by" as passive', () => {
    const issues = grammarCheck('The project was completed by your group.');
    expect(issues.some((i) => i.kind === 'passive-voice')).toBe(true);
  });

  it('flags "is graded" form', () => {
    const issues = grammarCheck('Your essay is graded fairly.');
    expect(issues.some((i) => i.kind === 'passive-voice')).toBe(true);
  });

  it('does not flag active voice', () => {
    const issues = grammarCheck('You completed the project on time.');
    expect(issues.filter((i) => i.kind === 'passive-voice')).toHaveLength(0);
  });
});

describe('grammarCheck — run-on heuristic', () => {
  it('flags a very long comma-heavy sentence with no period', () => {
    const longSentence =
      'You worked hard this year and you improved a lot and you helped others ' +
      'and you stayed focused and you asked good questions and you finished strong ' +
      'and you never gave up and you set a great example for everyone around you here';
    const issues = grammarCheck(longSentence);
    expect(issues.some((i) => i.kind === 'run-on')).toBe(true);
  });

  it('does not flag normal sentences', () => {
    const issues = grammarCheck('You did well. Keep it up next year.');
    expect(issues.filter((i) => i.kind === 'run-on')).toHaveLength(0);
  });
});
