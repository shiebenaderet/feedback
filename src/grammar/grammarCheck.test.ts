// src/grammar/grammarCheck.test.ts
import { describe, it, expect } from 'vitest';
import { grammarCheck, type GrammarIssue } from './grammarCheck';

describe('grammarCheck — double words', () => {
  it('flags a repeated word', () => {
    const issues = grammarCheck('You did did a great job.');
    expect(issues).toContainEqual<GrammarIssue>({
      kind: 'double-word',
      message: 'Repeated word: "did"',
      excerpt: 'did did',
    });
  });

  it('ignores case but still flags repeats', () => {
    const issues = grammarCheck('The the answer is correct.');
    expect(issues.some((i) => i.kind === 'double-word')).toBe(true);
  });

  it('does not flag non-repeats', () => {
    const issues = grammarCheck('You did a great job today.');
    expect(issues.filter((i) => i.kind === 'double-word')).toHaveLength(0);
  });
});

describe('grammarCheck — homophones', () => {
  it('flags possible their/there/they\'re confusion', () => {
    const issues = grammarCheck('Their going to enjoy this.');
    expect(issues.some((i) => i.kind === 'homophone')).toBe(true);
  });

  it('does not flag clean text', () => {
    const issues = grammarCheck('She improved every week.');
    expect(issues).toHaveLength(0);
  });
});
