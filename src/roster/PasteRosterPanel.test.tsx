// src/roster/PasteRosterPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PasteRosterPanel } from './PasteRosterPanel';

describe('PasteRosterPanel', () => {
  it('parses the pasted text and calls onParsed with the ParseResult', () => {
    const onParsed = vi.fn();
    render(<PasteRosterPanel onParsed={onParsed} />);
    fireEvent.change(screen.getByLabelText(/paste/i), {
      target: { value: 'Ada Lovelace, ada@x.edu\nAlan Turing, alan@x.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /parse & add/i }));
    expect(onParsed).toHaveBeenCalledTimes(1);
    const result = onParsed.mock.calls[0][0];
    expect(result.students.map((s: { email: string }) => s.email)).toEqual([
      'ada@x.edu',
      'alan@x.edu',
    ]);
  });

  it('does not call onParsed when the textarea is empty', () => {
    const onParsed = vi.fn();
    render(<PasteRosterPanel onParsed={onParsed} />);
    fireEvent.click(screen.getByRole('button', { name: /parse & add/i }));
    expect(onParsed).not.toHaveBeenCalled();
  });
});
