// src/bank/BankEntryForm.tsx
import { useMemo, useState } from "react";
import { makeBankEntryInput, EMPTY_TAGS } from "./types";
import type { BankEntryInput, BankTags } from "./types";
import { extractSlots } from "./extractSlots";

// BankEntryInput = { templateText; slots; tags: BankTags }
// BankTags = { type; area; objective; tone }

const TAG_KEYS: (keyof BankTags)[] = ["type", "area", "objective", "tone"];

interface BankEntryFormProps {
  initial?: BankEntryInput;
  onSave: (input: BankEntryInput) => void;
}

export function BankEntryForm({ initial, onSave }: BankEntryFormProps) {
  const [templateText, setTemplateText] = useState(initial?.templateText ?? "");
  const [tags, setTags] = useState<BankTags>(initial?.tags ?? { ...EMPTY_TAGS });

  // Live-derived slots for the preview; recomputed as the text changes.
  const slots = useMemo(() => extractSlots(templateText), [templateText]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(makeBankEntryInput({ templateText, tags }));
  }

  function setTag(key: keyof BankTags, value: string) {
    setTags((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="templateText">Template text</label>
      <textarea
        id="templateText"
        value={templateText}
        onChange={(e) => setTemplateText(e.target.value)}
      />

      <ul aria-label="slots">
        {slots.map((slot) => (
          <li key={slot.key} data-testid={`slot-${slot.key}`}>
            {slot.key} — {slot.kind}
          </li>
        ))}
      </ul>

      {TAG_KEYS.map((key) => (
        <div key={key}>
          <label htmlFor={`tag-${key}`}>{key}</label>
          <input
            id={`tag-${key}`}
            value={tags[key]}
            onChange={(e) => setTag(key, e.target.value)}
          />
        </div>
      ))}

      <button type="submit">Save</button>
    </form>
  );
}
