import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudentRowActions } from './StudentRowActions';
import type { RosterStudent } from './RosterTable';

const student: RosterStudent = {
  id: 's1',
  name: 'Ada Lovelace',
  email: 'ada@x.edu',
  period: '4',
};

describe('StudentRowActions', () => {
  it('shows Edit and Remove buttons by default (no form fields)', () => {
    render(<StudentRowActions student={student} onEdit={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
  });

  it('Edit reveals inputs prefilled with the current values', () => {
    render(<StudentRowActions student={student} onEdit={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Ada Lovelace');
    expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe('ada@x.edu');
    expect((screen.getByLabelText(/period/i) as HTMLInputElement).value).toBe('4');
  });

  it('Save fires onEdit with the edited patch', () => {
    const onEdit = vi.fn();
    render(<StudentRowActions student={student} onEdit={onEdit} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ada L.' } });
    fireEvent.change(screen.getByLabelText(/period/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onEdit).toHaveBeenCalledWith({ name: 'Ada L.', email: 'ada@x.edu', period: '2' });
  });

  it('blocks Save and shows an error on an invalid email; never calls onEdit', () => {
    const onEdit = vi.fn();
    render(<StudentRowActions student={student} onEdit={onEdit} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/email/i);
  });

  it('Cancel exits edit mode without calling onEdit', () => {
    const onEdit = vi.fn();
    render(<StudentRowActions student={student} onEdit={onEdit} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('Remove asks to confirm first, then fires onRemove on confirm', () => {
    const onRemove = vi.fn();
    render(<StudentRowActions student={student} onEdit={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    expect(onRemove).not.toHaveBeenCalled(); // first click only arms confirm
    fireEvent.click(screen.getByRole('button', { name: /confirm remove/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('Remove can be backed out of without firing onRemove', () => {
    const onRemove = vi.fn();
    render(<StudentRowActions student={student} onEdit={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^remove$/i })).toBeInTheDocument();
  });
});
