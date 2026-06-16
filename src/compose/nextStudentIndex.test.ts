// src/compose/nextStudentIndex.test.ts
import { describe, it, expect } from 'vitest';
import { nextStudentIndex } from './nextStudentIndex';

describe('nextStudentIndex', () => {
  it('advances to the next index when not at the end', () => {
    expect(nextStudentIndex(0, 5)).toBe(1);
    expect(nextStudentIndex(3, 5)).toBe(4);
  });

  it('clamps at the last index (no wrap past the end)', () => {
    expect(nextStudentIndex(4, 5)).toBe(4);
  });

  it('returns 0 for an empty roster', () => {
    expect(nextStudentIndex(0, 0)).toBe(0);
  });

  it('clamps a current index that is already out of range', () => {
    expect(nextStudentIndex(10, 5)).toBe(4);
  });
});
