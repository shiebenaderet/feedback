import type { BankEntry, Slot } from '../types';
import { tokens } from '../ui/theme';

export interface FillSlotInputsProps {
  selectedEntries: BankEntry[];
  slotValues: Record<string, string>;
  setSlotValue: (key: string, val: string) => void;
}

/** A friendlier visible label + placeholder for a slot key (aria-label stays the key). */
function slotPrompt(key: string): { label: string; placeholder: string } {
  if (key === 'detail') {
    return {
      label: 'Add a personal touch (optional)',
      placeholder: 'e.g. I loved your point about the New Deal — leave blank to skip',
    };
  }
  return { label: key, placeholder: '' };
}

// Collect each distinct FILL slot across the selected entries, first occurrence wins.
function collectFillSlots(entries: BankEntry[]): Slot[] {
  const seen = new Set<string>();
  const out: Slot[] = [];
  for (const entry of entries) {
    for (const slot of entry.slots) {
      if (slot.kind === 'fill' && !seen.has(slot.key)) {
        seen.add(slot.key);
        out.push(slot);
      }
    }
  }
  return out;
}

export function FillSlotInputs({
  selectedEntries,
  slotValues,
  setSlotValue,
}: FillSlotInputsProps) {
  const fillSlots = collectFillSlots(selectedEntries);
  if (fillSlots.length === 0) return null;

  return (
    <div className="fill-slot-inputs" style={{ display: 'grid', gap: tokens.space(1.5) }}>
      {fillSlots.map((slot) => {
        const prompt = slotPrompt(slot.key);
        return (
          <label key={slot.key} style={{ display: 'grid', gap: 4 }}>
            <span style={{ color: tokens.color.muted, fontSize: 13 }}>{prompt.label}</span>
            <input
              aria-label={slot.key}
              placeholder={slot.hint || prompt.placeholder}
              value={slotValues[slot.key] ?? ''}
              onChange={(e) => setSlotValue(slot.key, e.target.value)}
              style={{ width: '100%' }}
            />
          </label>
        );
      })}
    </div>
  );
}
