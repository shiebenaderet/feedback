import { describe, it, expect } from 'vitest';
import {
  deriveSentiment,
  GRADING_PERIODS,
  TAG_CATEGORIES,
  SENTIMENT_BY_TYPE,
  type Sentiment,
  type GradingPeriod,
  type TagCategory,
} from './taxonomy';

describe('taxonomy: deriveSentiment', () => {
  it('maps success -> strength', () => {
    expect(deriveSentiment('success')).toBe('strength');
  });

  it('maps growth -> growth', () => {
    expect(deriveSentiment('growth')).toBe('growth');
  });

  it('maps behavior -> neutral', () => {
    expect(deriveSentiment('behavior')).toBe('neutral');
  });

  it('maps skill -> neutral', () => {
    expect(deriveSentiment('skill')).toBe('neutral');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(deriveSentiment('  SUCCESS ')).toBe('strength');
    expect(deriveSentiment('Growth')).toBe('growth');
  });

  it('falls back to neutral for an unknown or empty type', () => {
    expect(deriveSentiment('mystery')).toBe('neutral');
    expect(deriveSentiment('')).toBe('neutral');
    expect(deriveSentiment(undefined)).toBe('neutral');
  });

  it('every value in SENTIMENT_BY_TYPE is a valid Sentiment', () => {
    const valid: Sentiment[] = ['strength', 'growth', 'neutral'];
    for (const s of Object.values(SENTIMENT_BY_TYPE)) {
      expect(valid).toContain(s);
    }
  });
});

describe('taxonomy: GRADING_PERIODS', () => {
  it('is exactly the ordered pilot list', () => {
    expect(GRADING_PERIODS).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'S1', 'S2', 'EOY']);
  });

  it('is a readonly tuple whose members are assignable to GradingPeriod', () => {
    const first: GradingPeriod = GRADING_PERIODS[0];
    expect(first).toBe('Q1');
    // EOY is a member
    expect(GRADING_PERIODS).toContain<GradingPeriod>('EOY');
  });
});

describe('taxonomy: TAG_CATEGORIES', () => {
  it('lists the derived feedback-history tag categories', () => {
    expect(TAG_CATEGORIES).toEqual(['areas', 'sentiments', 'standards']);
  });

  it('members are assignable to TagCategory', () => {
    const c: TagCategory = TAG_CATEGORIES[0];
    expect(c).toBe('areas');
  });
});
