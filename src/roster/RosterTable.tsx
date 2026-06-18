// src/roster/RosterTable.tsx
import { useState } from 'react';
import { sortStudentsByName, type SortDir } from './sortStudents';
import { StudentRowActions, type StudentEditPatch } from './StudentRowActions';
import { tokens, panelStyle, chipStyle } from '../ui/theme';

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
    return (
      <div
        className="roster-empty"
        style={{
          ...panelStyle(),
          background: tokens.color.panelAlt,
          textAlign: 'center',
          padding: tokens.space(4),
        }}
      >
        <p style={{ margin: 0, color: tokens.color.text, fontWeight: 600 }}>No students yet.</p>
        <p style={{ margin: `${tokens.space(1)}px 0 0`, color: tokens.color.muted, fontSize: 13 }}>
          Import a CSV, paste a list, or add a student to get started.
        </p>
      </div>
    );
  }

  const sorted = sortStudentsByName(students, dir);
  const arrow = dir === 'asc' ? '▲' : '▼';

  return (
    <table className="roster-table">
      <thead>
        <tr>
          <th>
            <button
              type="button"
              onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                color: tokens.color.muted,
                font: 'inherit',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
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
            <td style={{ color: tokens.color.text }}>{s.name}</td>
            <td style={{ color: tokens.color.muted }}>{s.email}</td>
            <td>
              {s.period ? (
                <span style={chipStyle(false)}>{s.period}</span>
              ) : (
                <span style={{ color: tokens.color.muted }}>—</span>
              )}
            </td>
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
