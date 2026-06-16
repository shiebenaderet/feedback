// src/roster/ImportPreview.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportPreview } from './ImportPreview';

// ParseResult shape (src/roster/types.ts):
//   { students:[{name,email,period,sourceRow}], skipped:[{sourceRow,reason,raw}],
//     duplicates:[{email,sourceRows}], columnMapping:{name,email,period} }
const result = {
  students: [
    { name: 'Ada Lovelace', email: 'ada@x.edu', period: '3', sourceRow: 2 },
    { name: 'Alan Turing', email: 'alan@x.edu', period: '3', sourceRow: 3 },
  ],
  skipped: [{ sourceRow: 4, reason: 'Missing email', raw: { Name: 'No Email', Email: '' } }],
  duplicates: [],
  columnMapping: { name: 'Name', email: 'Email', period: 'Period' },
};

describe('ImportPreview', () => {
  it('summarizes found and skipped counts', () => {
    render(<ImportPreview result={result} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/found 2 students/i)).toBeInTheDocument();
    expect(screen.getByText(/1 skipped/i)).toBeInTheDocument();
  });

  it('shows the column mapping and each skipped row with its reason', () => {
    render(<ImportPreview result={result} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/name → Name/i)).toBeInTheDocument();
    expect(screen.getByText(/email → Email/i)).toBeInTheDocument();
    expect(screen.getByText(/Row 4/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing email/i)).toBeInTheDocument();
  });

  it('confirm is enabled and fires onConfirm when there are students', () => {
    const onConfirm = vi.fn();
    render(<ImportPreview result={result} onConfirm={onConfirm} onCancel={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /import 2 students/i });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables confirm when there are zero importable students', () => {
    const empty = { ...result, students: [] };
    render(<ImportPreview result={empty} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /import 0 students/i })).toBeDisabled();
  });
});
