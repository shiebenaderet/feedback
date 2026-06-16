// src/bank/types.ts
import { extractSlots, type Slot } from "./extractSlots";

// Slot is re-exported so consumers import everything bank-shaped from one place.
// Slot = { key: string; kind: "auto" | "fill"; hint: string }
export type { Slot };

// Tags on a bank entry. unit/project are deferred (spec), so only these four.
export interface BankTags {
  type: string;
  area: string;
  objective: string;
  tone: string;
}

export const EMPTY_TAGS: BankTags = {
  type: "",
  area: "",
  objective: "",
  tone: "",
};

// The fields a teacher edits + the derived slots. No id/owner here — those are
// added at the Firestore layer.
export interface BankEntryInput {
  templateText: string;
  slots: Slot[];
  tags: BankTags;
}

// A persisted bank entry: input fields plus its Firestore document id.
export interface BankEntry extends BankEntryInput {
  id: string;
}

/**
 * Builds a BankEntryInput from raw editor fields, deriving slots from the
 * template text so slots never desync from the text.
 */
export function makeBankEntryInput(fields: {
  templateText: string;
  tags: BankTags;
}): BankEntryInput {
  return {
    templateText: fields.templateText,
    slots: extractSlots(fields.templateText),
    tags: fields.tags,
  };
}
