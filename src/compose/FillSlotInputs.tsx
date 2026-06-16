import type { BankEntry, Slot } from '../types';

export interface FillSlotInputsProps {
  selectedEntries: BankEntry[];
  slotValues: Record<string, string>;
  setSlotValue: (key: string, val: string) => void;
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
    <div className="fill-slot-inputs">
      {fillSlots.map((slot) => (
        <label key={slot.key} style={{ display: 'block' }}>
          <span>{slot.key}</span>
          <input
            aria-label={slot.key}
            placeholder={slot.hint ?? ''}
            value={slotValues[slot.key] ?? ''}
            onChange={(e) => setSlotValue(slot.key, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
