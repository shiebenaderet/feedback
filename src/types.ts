import type { GradingPeriod } from './feedback/taxonomy';
// src/types.ts
// Canonical shared types — the SINGLE source of truth.
// Every other module imports from here; these shapes are never re-declared elsewhere.

export interface Student {
  id: string;
  name: string;
  email: string;
  period?: string;
}

export interface ClassMeta {
  id: string;
  name: string;
  period?: string;
  semester?: string;
  unit?: string;
  archived?: boolean;
}

export type SlotKind = 'auto' | 'fill';

export interface Slot {
  key: string;
  kind: SlotKind;
  hint?: string;
}

export interface BankTags {
  type?: string;
  area?: string;
  objective?: string;
  tone?: string;
}

export interface BankEntry {
  id: string;
  templateText: string;
  slots: Slot[];
  tags: BankTags;
}

export interface MessageDraft {
  studentId: string;
  name: string;
  usedEntries: string[];
  slotValues: Record<string, string>;
  finalText: string;
  status: 'draft' | 'sent' | 'failed';
}

export interface Batch {
  id: string;
  yearId: string;
  courseId: string;
  periodId: string; // replaces the old classId as the roster target
  sharedHeader: string;
  status: 'draft' | 'sending' | 'sent';
  gradingPeriod?: GradingPeriod; // stamped at the grading-period step before send
  label?: string; // optional free-text round label
}

// AUTO slot keys are exactly: name, semester.
// Exported as a const tuple so slot-filling logic (later tasks) references one definition.
export const AUTO_SLOT_KEYS = ['name', 'semester'] as const;
export type AutoSlotKey = (typeof AUTO_SLOT_KEYS)[number];

// ---------------------------------------------------------------------------
// REDESIGN domain types: Year > Course > Period > Student, with a longitudinal
// feedbackHistory layer. Firestore paths:
//   teachers/{uid}/years/{yearId}/courses/{courseId}/periods/{periodId}/students/{studentId}
//   .../students/{studentId}/feedbackHistory/{entryId}
// ---------------------------------------------------------------------------


/** A school year (e.g. "2025–2026"). Top of the new hierarchy. */
export interface Year {
  id: string;
  label: string;
}

/** A course/section within a year (e.g. "Period 3 Biology"). */
export interface Course {
  id: string;
  name: string;
  archived?: boolean;
}

/** A grading period within a course; `order` fixes its position in the year. */
export interface Period {
  id: string;
  label: string;
  order: number;
}

/**
 * One piece of feedback sent to one student, written on send/mark-sent
 * INDEPENDENTLY of batches. Stores raw `usedEntries` (bank ids) PLUS derived
 * `tags` so trends are re-derivable under a future taxonomy mapping.
 */
export interface FeedbackHistoryEntry {
  studentId: string;
  periodId: string;
  courseId: string;
  yearId: string;
  /** Epoch millis when the message was sent / marked sent. */
  sentAt: number;
  /** Which grading period this feedback belongs to (from taxonomy). */
  gradingPeriod: GradingPeriod;
  /** Optional human label, e.g. the shared header / batch name. */
  label?: string;
  /** The exact message text the student received. */
  finalText: string;
  /** Derived tags, re-derivable from usedEntries under a future mapping. */
  tags: {
    areas: string[];
    sentiments: string[];
    standards: string[];
  };
  /** Raw bank-entry ids that produced this message — the source of truth. */
  usedEntries: string[];
}

