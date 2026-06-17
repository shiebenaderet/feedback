// src/compose/fillSlots.ts
import { firstName } from './firstName';

export interface Slot {
  key: string;
  kind: 'auto' | 'fill';
  hint?: string;
}

export interface BankEntryLike {
  templateText: string;
  slots: Slot[];
}

export interface StudentLike {
  name: string;
  email: string;
  period?: string;
}

export interface ClassMetaLike {
  semester?: string;
}

export class UnfilledSlotError extends Error {
  constructor(public readonly slotKey: string) {
    super(`Unfilled slot: "${slotKey}"`);
    this.name = 'UnfilledSlotError';
  }
}

/** Auto slots resolve from the student/class; everything else is teacher-provided. */
function resolveAuto(
  key: string,
  student: StudentLike,
  classMeta: ClassMetaLike,
): string {
  switch (key) {
    case 'name':
      return firstName(student.name);
    case 'semester':
      return classMeta.semester ?? '';
    default:
      throw new Error(`Unknown auto slot: "${key}"`);
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tidies the whitespace left after an OPTIONAL add-on slot was filled with ""
 * in lenient mode, so a skipped detail never leaves a doubled space or a space
 * before punctuation. Optional details are written as self-contained add-on
 * sentences (e.g. "...this class.{detail}"), so empty ones just disappear.
 * Only runs in lenient (preview) mode; strict send-time text is exact.
 */
function tidyEmptyClauses(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, ' ') // collapse doubled spaces
    .replace(/\s+([.!?,;:])/g, '$1') // no space before punctuation
    .trim();
}

/**
 * Pure: given a bank entry, a student, class metadata, and the teacher's fill answers,
 * return the finished message text. Throws UnfilledSlotError if a "fill" slot is empty.
 */
export interface FillOptions {
  /**
   * When true, an unfilled "fill" slot becomes an empty string instead of throwing.
   * Used for the live compose preview (blanks show as gaps while you type); the
   * default strict mode is used at review/send time to catch unfinished messages.
   */
  lenient?: boolean;
}

export function fillSlots(
  entry: BankEntryLike,
  student: StudentLike,
  classMeta: ClassMetaLike,
  slotValues: Record<string, string>,
  options: FillOptions = {},
): string {
  let text = entry.templateText;

  for (const slot of entry.slots) {
    let value: string;
    if (slot.kind === 'auto') {
      value = resolveAuto(slot.key, student, classMeta);
    } else {
      const raw = slotValues[slot.key];
      if (raw == null || raw.trim() === '') {
        if (options.lenient) {
          value = '';
        } else {
          throw new UnfilledSlotError(slot.key);
        }
      } else {
        value = raw;
      }
    }
    const token = new RegExp(escapeRegExp(`{${slot.key}}`), 'g');
    text = text.replace(token, value);
  }

  // In lenient mode an optional inline slot may have collapsed to ""; tidy the
  // orphaned punctuation/whitespace it leaves so the preview reads cleanly.
  if (options.lenient) text = tidyEmptyClauses(text);

  return text;
}
