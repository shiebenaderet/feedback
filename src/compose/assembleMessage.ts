// src/compose/assembleMessage.ts
import {
  fillSlots,
  type BankEntryLike,
  type StudentLike,
  type ClassMetaLike,
} from './fillSlots';

export interface AssembleInput {
  header: string;
  entries: (BankEntryLike & { id: string })[];
  student: StudentLike;
  classMeta: ClassMetaLike;
  slotValues: Record<string, string>;
  /**
   * Pass true for the live compose preview: unfilled "fill" slots render as blanks
   * instead of throwing. Omit (strict) at review/send time to catch unfinished work.
   */
  lenient?: boolean;
}

/**
 * Build the full finalText for one student's message:
 * shared header (if any) followed by each bank entry filled in, blank-line separated.
 * In strict mode (default) throws UnfilledSlotError if any "fill" slot is empty;
 * in lenient mode unfilled slots become blanks (for the live preview).
 */
export function assembleMessage(input: AssembleInput): string {
  const { header, entries, student, classMeta, slotValues, lenient } = input;

  const parts: string[] = [];
  if (header.trim() !== '') {
    parts.push(header);
  }
  for (const entry of entries) {
    parts.push(fillSlots(entry, student, classMeta, slotValues, { lenient }));
  }

  return parts.join('\n\n');
}
