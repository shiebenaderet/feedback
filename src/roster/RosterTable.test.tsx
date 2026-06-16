// src/roster/RosterTable.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { RosterTable } from './RosterTable';

// Student shape rendered: { id, name, email, period }
const students = [
  { id: 'a', name: 'Brian K', email: 'brian@x.edu', period: '3' },
  { id: 'b', name: 'Ada Lovelace', email: 'ada@x.edu', period: '3' },
  { id: 'c', name: 'alan turing', email: 'alan@x.edu', period: '2' },
];

function rowNames(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1) // skip header row
    .map((r) => within(r).getAllByRole('cell')[0].textContent);
}

describe('RosterTable', () => {
  it('renders rows sorted by name ascending by default', () => {
    render(<RosterTable students={students} />);
    expect(rowNames()).toEqual(['Ada Lovelace', 'alan turing', 'Brian K']);
  });

  it('toggles to descending when the Name header is clicked', () => {
    render(<RosterTable students={students} />);
    fireEvent.click(screen.getByRole('button', { name: /name/i }));
    expect(rowNames()).toEqual(['Brian K', 'alan turing', 'Ada Lovelace']);
  });

  it('shows an empty state when there are no students', () => {
    render(<RosterTable students={[]} />);
    expect(screen.getByText(/no students yet/i)).toBeInTheDocument();
  });
});
