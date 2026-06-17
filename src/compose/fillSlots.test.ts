// src/compose/fillSlots.test.ts
import { describe, it, expect } from 'vitest';
import { fillSlots, UnfilledSlotError } from './fillSlots';

// Shapes restated from the Firestore data model (spec):
// BankEntry: { templateText: string; slots: { key: string; kind: 'auto' | 'fill'; hint?: string }[] }
// Student:   { name: string; email: string; period?: string }
// ClassMeta: { semester?: string }

const baseStudent = { name: 'Carlos Diaz', email: 'carlos@example.com', period: '3' };
const baseClass = { semester: 'Spring 2026' };

describe('fillSlots', () => {
  it('resolves auto slots (name, semester) from student and class', () => {
    const entry = {
      templateText: 'Hi {name}, great work this {semester}.',
      slots: [
        { key: 'name', kind: 'auto' as const },
        { key: 'semester', kind: 'auto' as const },
      ],
    };
    const result = fillSlots(entry, baseStudent, baseClass, {});
    expect(result).toBe('Hi Carlos Diaz, great work this Spring 2026.');
  });

  it('substitutes provided fill-slot values', () => {
    const entry = {
      templateText: 'You showed real growth in {topic}.',
      slots: [{ key: 'topic', kind: 'fill' as const, hint: 'a subject area' }],
    };
    const result = fillSlots(entry, baseStudent, baseClass, { topic: 'cell biology' });
    expect(result).toBe('You showed real growth in cell biology.');
  });

  it('mixes auto and fill slots in one template', () => {
    const entry = {
      templateText: '{name}, your {topic} essay this {semester} was excellent.',
      slots: [
        { key: 'name', kind: 'auto' as const },
        { key: 'topic', kind: 'fill' as const },
        { key: 'semester', kind: 'auto' as const },
      ],
    };
    const result = fillSlots(entry, baseStudent, baseClass, { topic: 'genetics' });
    expect(result).toBe('Carlos Diaz, your genetics essay this Spring 2026 was excellent.');
  });

  it('replaces every occurrence of a repeated slot', () => {
    const entry = {
      templateText: '{name}, keep it up {name}!',
      slots: [{ key: 'name', kind: 'auto' as const }],
    };
    const result = fillSlots(entry, baseStudent, baseClass, {});
    expect(result).toBe('Carlos Diaz, keep it up Carlos Diaz!');
  });

  it('throws UnfilledSlotError when a fill slot has no value', () => {
    const entry = {
      templateText: 'Great job on {topic}.',
      slots: [{ key: 'topic', kind: 'fill' as const, hint: 'a subject' }],
    };
    expect(() => fillSlots(entry, baseStudent, baseClass, {})).toThrow(UnfilledSlotError);
    expect(() => fillSlots(entry, baseStudent, baseClass, {})).toThrow(/topic/);
  });

  it('throws UnfilledSlotError when a fill slot value is blank/whitespace', () => {
    const entry = {
      templateText: 'Great job on {topic}.',
      slots: [{ key: 'topic', kind: 'fill' as const }],
    };
    expect(() => fillSlots(entry, baseStudent, baseClass, { topic: '   ' })).toThrow(
      UnfilledSlotError,
    );
  });

  it('throws when an auto slot key is not a known auto field', () => {
    const entry = {
      templateText: 'Hello {mystery}.',
      slots: [{ key: 'mystery', kind: 'auto' as const }],
    };
    expect(() => fillSlots(entry, baseStudent, baseClass, {})).toThrow(/mystery/);
  });

  describe('lenient mode — empty optional add-on slots degrade cleanly', () => {
    it('appends a filled optional detail sentence', () => {
      const entry = {
        templateText: 'You have great ideas and a real gift for this class.{detail}',
        slots: [{ key: 'detail', kind: 'fill' as const }],
      };
      const result = fillSlots(
        entry,
        baseStudent,
        baseClass,
        { detail: ' I especially loved your New Deal point.' },
        { lenient: true },
      );
      expect(result).toBe(
        'You have great ideas and a real gift for this class. I especially loved your New Deal point.',
      );
    });

    it('leaves no trailing space when the optional detail is skipped', () => {
      const entry = {
        templateText: 'You have great ideas and a real gift for this class.{detail}',
        slots: [{ key: 'detail', kind: 'fill' as const }],
      };
      const result = fillSlots(entry, baseStudent, baseClass, {}, { lenient: true });
      expect(result).toBe('You have great ideas and a real gift for this class.');
    });

    it('collapses doubled spaces from an empty mid-text slot', () => {
      const entry = {
        templateText: 'Strong work this year. {detail} Keep it up.',
        slots: [{ key: 'detail', kind: 'fill' as const }],
      };
      const result = fillSlots(entry, baseStudent, baseClass, {}, { lenient: true });
      expect(result).toBe('Strong work this year. Keep it up.');
    });
  });
});
