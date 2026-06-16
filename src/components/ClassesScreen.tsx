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

  return (
    <section>
      <h1>Classes</h1>
      <ul>
        {classes.map((c) => (
          <li key={c.id}>{c.name}</li>
        ))}
      </ul>

      <form onSubmit={handleSubmit}>
        <label htmlFor="class-name">Class name</label>
        <input id="class-name" value={name} onChange={(e) => setName(e.target.value)} />

        <label htmlFor="class-period">Period</label>
        <input id="class-period" value={period} onChange={(e) => setPeriod(e.target.value)} />

        <label htmlFor="class-semester">Semester</label>
        <input
          id="class-semester"
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
        />

        <label htmlFor="class-unit">Unit</label>
        <input id="class-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />

        <button type="submit">New class</button>
      </form>
    </section>
  );
}
