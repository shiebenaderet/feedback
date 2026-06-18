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

  it('skips done students and lands on the next not-done one', () => {
    // students 1 and 2 are done → from 0 we jump straight to 3
    expect(nextStudentIndex(0, 5, new Set([1, 2]))).toBe(3);
  });

  it('accepts an array of done indices (not just a Set)', () => {
    expect(nextStudentIndex(0, 5, [1, 2])).toBe(3);
  });

  it('clamps at the last index when every student ahead is done', () => {
    // everyone after 0 is done → no not-done ahead → clamp at last
    expect(nextStudentIndex(0, 4, new Set([1, 2, 3]))).toBe(3);
  });

  it('clamps at the last index when the whole roster is done', () => {
    expect(nextStudentIndex(1, 3, new Set([0, 1, 2]))).toBe(2);
  });

  it('ignores a done current student and still advances to the next not-done one', () => {
    // current (1) is done, 2 is done, 3 is not → land on 3
    expect(nextStudentIndex(1, 5, new Set([1, 2]))).toBe(3);
  });

  it('behaves like a plain clamp when no done set is given', () => {
    expect(nextStudentIndex(2, 5)).toBe(3);
    expect(nextStudentIndex(2, 5, null)).toBe(3);
  });
});
