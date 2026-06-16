import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useComposeMessage } from './useComposeMessage';
import { FillSlotInputs } from './FillSlotInputs';
import type { BankEntry, Student, ClassMeta } from '../types';

const student: Student = { id: 's1', name: 'Carlos', email: 'carlos@example.com' };
const classMeta: ClassMeta = { id: 'c1', name: 'Period 3 Biology', semester: 'spring' };

const growthEntry: BankEntry = {
  id: 'e1',
  templateText: '{name} grew this {semester} when {moment}.',
  slots: [
    { key: 'name', kind: 'auto' },
    { key: 'semester', kind: 'auto' },
    { key: 'moment', kind: 'fill', hint: 'a specific moment' },
  ],
  tags: { type: 'growth' },
};

const areaEntry: BankEntry = {
  id: 'e2',
  templateText: 'Keep pushing on {area}.',
  slots: [{ key: 'area', kind: 'fill', hint: 'an area' }],
  tags: { type: 'success' },
};

const allEntries = [growthEntry, areaEntry];

// Test harness wiring the hook to the UI and showing finalText.
function Harness() {
  const compose = useComposeMessage({ student, classMeta, allEntries });
  return (
    <div>
      <button onClick={() => compose.addEntry('e1')}>add-e1</button>
      <button onClick={() => compose.addEntry('e2')}>add-e2</button>
      <button onClick={() => compose.removeEntry('e1')}>remove-e1</button>
      <FillSlotInputs
        selectedEntries={compose.selectedEntries}
        slotValues={compose.slotValues}
        setSlotValue={compose.setSlotValue}
      />
      <pre data-testid="final">{compose.finalText}</pre>
    </div>
  );
}

describe('FillSlotInputs', () => {
  it('renders a labeled input only for unfilled fill slots, not auto slots', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('add-e1'));
    // auto slots (name/semester) get NO input
    expect(screen.queryByLabelText('name')).toBeNull();
    expect(screen.queryByLabelText('semester')).toBeNull();
    // fill slot gets a labeled input
    expect(screen.getByLabelText('moment')).toBeInstanceOf(HTMLInputElement);
  });

  it('typing in a fill-slot input updates finalText', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('add-e1'));
    fireEvent.change(screen.getByLabelText('moment'), {
      target: { value: 'he redesigned the experiment' },
    });
    expect(screen.getByTestId('final').textContent).toBe(
      'Carlos grew this spring when he redesigned the experiment.',
    );
  });

  it('removing an entry drops its fill-slot input', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('add-e1'));
    fireEvent.click(screen.getByText('add-e2'));
    expect(screen.getByLabelText('moment')).toBeTruthy();
    expect(screen.getByLabelText('area')).toBeTruthy();
    fireEvent.click(screen.getByText('remove-e1'));
    expect(screen.queryByLabelText('moment')).toBeNull();
    expect(screen.getByLabelText('area')).toBeTruthy();
  });

  it('uses the slot hint as placeholder when present', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('add-e1'));
    expect(screen.getByLabelText('moment')).toHaveProperty(
      'placeholder',
      'a specific moment',
    );
  });
});
