// src/roster/RosterTable.tsx
import { useState } from 'react';
import { sortStudentsByName, type SortDir } from './sortStudents';
import { StudentRowActions, type StudentEditPatch } from './StudentRowActions';

/** A persisted student loaded from Firestore (doc id + the stored fields). */
export interface RosterStudent {
  id: string;
  name: string;
  email: string;
  period: string;
}

interface RosterTableProps {
  students: RosterStudent[];
  /** When provided, each row gets Edit/Remove actions (Actions column appears). */
  onEditStudent?: (id: string, patch: StudentEditPatch) => void;
  onRemoveStudent?: (id: string) => void;
}

/** Roster view: a table of students, sortable by name (click the header to toggle). */
export function RosterTable({
  students,
  onEditStudent,
  onRemoveStudent,
}: RosterTableProps) {
  const [dir, setDir] = useState<SortDir>('asc');
  const hasActions = !!(onEditStudent || onRemoveStudent);

  if (students.length === 0) {
    return <p className="roster-empty">No students yet. Import a CSV to get started.</p>;
  }

  const sorted = sortStudentsByName(students, dir);
  const arrow = dir === 'asc' ? '▲' : '▼';

  return (
    <table className="roster-table">
      <thead>
        <tr>
          <th>
            <button type="button" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}>
              Name {arrow}
            </button>
          </th>
          <th>Email</th>
          <th>Period</th>
          {hasActions && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {sorted.map((s) => (
          <tr key={s.id}>
            <td>{s.name}</td>
            <td>{s.email}</td>
            <td>{s.period}</td>
            {hasActions && (
              <td>
                <StudentRowActions
                  student={s}
                  onEdit={(patch) => onEditStudent?.(s.id, patch)}
                  onRemove={() => onRemoveStudent?.(s.id)}
                />
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
