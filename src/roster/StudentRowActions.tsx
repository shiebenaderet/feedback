// src/roster/StudentRowActions.tsx
import { useState } from 'react';
import type { Student } from '../types';
import type { RosterStudent } from './RosterTable';

/** Same email shape the roster importer validates with (src/roster/parseRoster.ts). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StudentEditPatch = Pick<Student, 'name' | 'email' | 'period'>;

interface StudentRowActionsProps {
  student: RosterStudent;
  onEdit: (patch: StudentEditPatch) => void;
  onRemove: () => void;
}

type Mode = 'idle' | 'editing' | 'confirming';

/**
 * Per-row Edit / Remove affordances for the roster. Edit reveals inline
 * name/email/period inputs (email re-validated before Save); Remove is a
 * two-step confirm. Fully callback-driven so it’s testable with vi.fn().
 */
export function StudentRowActions({ student, onEdit, onRemove }: StudentRowActionsProps) {
  const [mode, setMode] = useState<Mode>('idle');
  const [name, setName] = useState(student.name);
  const [email, setEmail] = useState(student.email);
  const [period, setPeriod] = useState(student.period);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setName(student.name);
    setEmail(student.email);
    setPeriod(student.period);
    setError(null);
    setMode('editing');
  }

  function save() {
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    onEdit({ name, email, period });
    setMode('idle');
  }

  if (mode === 'editing') {
    return (
      <div className="student-row-edit">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Period
          <input value={period} onChange={(e) => setPeriod(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="button" className="accent" onClick={save}>
          Save
        </button>
        <button type="button" onClick={() => setMode('idle')}>
          Cancel
        </button>
      </div>
    );
  }

  if (mode === 'confirming') {
    return (
      <div className="student-row-confirm">
        <span>Remove {student.name}?</span>
        <button type="button" className="danger" onClick={onRemove}>
          Confirm remove
        </button>
        <button type="button" onClick={() => setMode('idle')}>
          Keep
        </button>
      </div>
    );
  }

  return (
    <div className="student-row-actions">
      <button type="button" onClick={startEdit}>
        Edit
      </button>
      <button type="button" onClick={() => setMode('confirming')}>
        Remove
      </button>
    </div>
  );
}
