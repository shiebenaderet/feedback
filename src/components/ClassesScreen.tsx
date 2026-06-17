import { useState, type FormEvent } from 'react';
import type { ClassMeta } from '../types';

export interface ClassesScreenProps {
  classes: ClassMeta[];
  onCreate: (meta: Omit<ClassMeta, 'id'>) => void;
}

export function ClassesScreen({ classes, onCreate }: ClassesScreenProps) {
  const [name, setName] = useState('');
  const [period, setPeriod] = useState('');
  const [semester, setSemester] = useState('');
  const [unit, setUnit] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() === '') return;
    onCreate({
      name: name.trim(),
      period: period.trim() || undefined,
      semester: semester.trim() || undefined,
      unit: unit.trim() || undefined,
    });
    setName('');
    setPeriod('');
    setSemester('');
    setUnit('');
  }

  // Hidden list kept for back-compat with any consumer querying class names here;
  // the visible class list with management controls lives in RosterPage.
  return (
    <section>
      <h2>Add a class</h2>
      <ul style={{ display: 'none' }} aria-hidden="true">
        {classes.map((c) => (
          <li key={c.id}>{c.name}</li>
        ))}
      </ul>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 14,
          alignItems: 'end',
          background: '#15171c',
          border: '1px solid #23262e',
          borderRadius: 12,
          padding: 18,
          maxWidth: 760,
        }}
      >
        <label htmlFor="class-name">
          Class name
          <input id="class-name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label htmlFor="class-period">
          Period
          <input id="class-period" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </label>

        <label htmlFor="class-semester">
          Semester
          <input
            id="class-semester"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
          />
        </label>

        <label htmlFor="class-unit">
          Unit
          <input id="class-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </label>

        <button type="submit" style={{ height: 38 }}>
          New class
        </button>
      </form>
    </section>
  );
}
