// src/roster/AddStudentForm.tsx
import { useState } from 'react';
import { tokens, tealButtonStyle } from '../ui/theme';

/** Same email shape the roster importer validates with (src/roster/parseRoster.ts). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface NewStudentInput {
  name: string;
  email: string;
}

interface AddStudentFormProps {
  onAdd: (student: NewStudentInput) => void;
}

/**
 * The "Type manually" entry method: name + email + Add student. Validates that a name
 * is present and the email matches the importer's regex before calling onAdd, then
 * clears for the next entry. Fully callback-driven so it's testable with vi.fn().
 */
export function AddStudentForm({ onAdd }: AddStudentFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError('Enter a student name.');
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    onAdd({ name: trimmedName, email: trimmedEmail });
    setName('');
    setEmail('');
    setError(null);
  }

  return (
    <div
      className="add-student-form"
      style={{ display: 'flex', gap: tokens.space(1), alignItems: 'flex-end', flexWrap: 'wrap' }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', color: tokens.color.subtle }}>
        Student name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', color: tokens.color.subtle }}>
        Student email
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <button type="button" style={tealButtonStyle()} onClick={submit}>
        Add student
      </button>
      {error && (
        <p role="alert" style={{ color: tokens.color.danger, width: '100%', margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
