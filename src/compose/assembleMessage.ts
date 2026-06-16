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
}

/**
 * Build the full finalText for one student's message:
 * shared header (if any) followed by each bank entry filled in, blank-line separated.
 * Throws UnfilledSlotError (from fillSlots) if any "fill" slot is empty.
 */
export function assembleMessage(input: AssembleInput): string {
  const { header, entries, student, classMeta, slotValues } = input;

  const parts: string[] = [];
  if (header.trim() !== '') {
    parts.push(header);
  }
  for (const entry of entries) {
    parts.push(fillSlots(entry, student, classMeta, slotValues));
  }

  return parts.join('\n\n');
}
