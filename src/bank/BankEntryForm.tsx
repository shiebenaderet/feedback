// src/bank/BankEntryForm.tsx
import { useMemo, useState } from "react";
import { makeBankEntryInput, EMPTY_TAGS } from "./types";
import type { BankEntryInput, BankTags } from "./types";
import { extractSlots } from "./extractSlots";
import { tokens, cardStyle, tealButtonStyle } from "../ui/theme";

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
    <form
      onSubmit={handleSubmit}
      style={{
        ...cardStyle(),
        maxWidth: 640,
        display: "grid",
        gap: tokens.space(2.5),
      }}
    >
      <div style={{ display: "grid", gap: tokens.space(0.75) }}>
        <label htmlFor="templateText">Template text</label>
        <textarea
          id="templateText"
          value={templateText}
          onChange={(e) => setTemplateText(e.target.value)}
          style={{ width: "100%", minHeight: 120 }}
        />
        <ul
          aria-label="slots"
          style={{
            listStyle: "none",
            margin: slots.length ? `${tokens.space(0.5)}px 0 0` : 0,
            padding: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: tokens.space(0.75),
          }}
        >
          {slots.map((slot) => (
            <li
              key={slot.key}
              data-testid={`slot-${slot.key}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: tokens.color.panelAlt,
                color: tokens.color.muted,
                border: `1px solid ${tokens.color.border}`,
                borderRadius: 999,
                padding: "2px 10px",
                fontSize: 12,
                fontFamily: tokens.mono,
              }}
            >
              {slot.key} — {slot.kind}
            </li>
          ))}
        </ul>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: tokens.space(2),
        }}
      >
        {TAG_KEYS.map((key) => (
          <div key={key} style={{ display: "grid", gap: tokens.space(0.75) }}>
            <label htmlFor={`tag-${key}`}>{key}</label>
            <input
              id={`tag-${key}`}
              value={tags[key]}
              onChange={(e) => setTag(key, e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        ))}
      </div>

      <button type="submit" style={{ ...tealButtonStyle(), justifySelf: "start" }}>
        Save
      </button>
    </form>
  );
}
