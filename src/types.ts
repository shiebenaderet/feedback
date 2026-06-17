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
  classId: string;
  sharedHeader: string;
  status: 'draft' | 'sending' | 'sent';
}

// AUTO slot keys are exactly: name, semester.
// Exported as a const tuple so slot-filling logic (later tasks) references one definition.
export const AUTO_SLOT_KEYS = ['name', 'semester'] as const;
export type AutoSlotKey = (typeof AUTO_SLOT_KEYS)[number];
