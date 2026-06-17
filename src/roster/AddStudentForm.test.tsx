// src/roster/AddStudentForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddStudentForm } from './AddStudentForm';

describe('AddStudentForm', () => {
  it('calls onAdd with the trimmed name and email, then clears the fields', () => {
    const onAdd = vi.fn();
    render(<AddStudentForm onAdd={onAdd} />);
    const name = screen.getByLabelText('Student name') as HTMLInputElement;
    const email = screen.getByLabelText('Student email') as HTMLInputElement;
    fireEvent.change(name, { target: { value: '  Ada Lovelace ' } });
    fireEvent.change(email, { target: { value: ' ada@x.edu ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add student' }));
    expect(onAdd).toHaveBeenCalledWith({ name: 'Ada Lovelace', email: 'ada@x.edu' });
    expect(name.value).toBe('');
    expect(email.value).toBe('');
  });

  it('rejects an invalid email and does not call onAdd', () => {
    const onAdd = vi.fn();
    render(<AddStudentForm onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText('Student name'), { target: { value: 'Bad Email' } });
    fireEvent.change(screen.getByLabelText('Student email'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add student' }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
  });

  it('rejects a blank name and does not call onAdd', () => {
    const onAdd = vi.fn();
    render(<AddStudentForm onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText('Student email'), { target: { value: 'ada@x.edu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add student' }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/name/i);
  });
});
