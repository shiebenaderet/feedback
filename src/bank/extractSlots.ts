// src/bank/extractSlots.ts

// A slot parsed from template text. Mirrors the bankEntry slot shape:
// { key: string; kind: "auto" | "fill"; hint: string }
export interface Slot {
  key: string;
  kind: "auto" | "fill";
  hint: string;
}

// Auto-resolvable slot keys (everything else is a "you-fill" slot).
const AUTO_KEYS = new Set(["name", "semester"]);

/**
 * Extracts {slot} keys from template text in source order, de-duplicated,
 * and classifies each as "auto" (name/semester) or "fill" (everything else).
 * Keys are trimmed and lowercased; empty braces are ignored. hint starts blank.
 */
export function extractSlots(templateText: string): Slot[] {
  const pattern = /\{([^{}]*)\}/g;
  const seen = new Set<string>();
  const slots: Slot[] = [];

  for (const match of templateText.matchAll(pattern)) {
    const key = match[1].trim().toLowerCase();
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    slots.push({
      key,
      kind: AUTO_KEYS.has(key) ? "auto" : "fill",
      hint: "",
    });
  }

  return slots;
}
