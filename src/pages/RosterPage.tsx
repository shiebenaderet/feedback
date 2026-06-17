import { useEffect, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { createClass } from '../data/createClass';
import { listClasses } from '../data/listClasses';
import { saveStudents } from '../data/saveStudents';
import { listStudents } from '../data/listStudents';
import { renameClass } from '../data/renameClass';
import { archiveClass } from '../data/archiveClass';
import { deleteClass } from '../data/deleteClass';
import { updateStudent } from '../data/updateStudent';
import { deleteStudent } from '../data/deleteStudent';
import { ClassesScreen } from '../components/ClassesScreen';
import { parseRoster } from '../roster/parseRoster';
import { ImportPreview } from '../roster/ImportPreview';
import { RosterTable, type RosterStudent } from '../roster/RosterTable';
import type { StudentEditPatch } from '../roster/StudentRowActions';
import { EMPTY_PARSE_RESULT, type ParseResult } from '../roster/types';
import type { ClassMeta, Student } from '../types';

/**
 * The live Roster screen, wiring together the tested roster units:
 * pick/create a class → upload a CSV → preview (found/skipped) → confirm →
 * the saved students render in a sortable table.
 *
 * Firestore/auth are injectable so the smoke test drives it without a backend;
 * production uses the real db + the signed-in teacher's uid.
 */
export interface RosterPageDeps {
  uid: string;
  listClasses: typeof listClasses;
  createClass: typeof createClass;
  saveStudents: typeof saveStudents;
  listStudents: typeof listStudents;
  renameClass: typeof renameClass;
  archiveClass: typeof archiveClass;
  deleteClass: typeof deleteClass;
  updateStudent: typeof updateStudent;
  deleteStudent: typeof deleteStudent;
}

export function RosterPage({ deps }: { deps?: Partial<RosterPageDeps> }) {
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const api = {
    listClasses: deps?.listClasses ?? listClasses,
    createClass: deps?.createClass ?? createClass,
    saveStudents: deps?.saveStudents ?? saveStudents,
    listStudents: deps?.listStudents ?? listStudents,
    renameClass: deps?.renameClass ?? renameClass,
    archiveClass: deps?.archiveClass ?? archiveClass,
    deleteClass: deps?.deleteClass ?? deleteClass,
    updateStudent: deps?.updateStudent ?? updateStudent,
    deleteStudent: deps?.deleteStudent ?? deleteStudent,
  };

  const [classes, setClasses] = useState<ClassMeta[]>([]);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParseResult>(EMPTY_PARSE_RESULT);
  const [showPreview, setShowPreview] = useState(false);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reloadClasses() {
    api
      .listClasses(db, uid, undefined, { includeArchived: showArchived })
      .then(setClasses)
      .catch(() => setError('Could not load classes.'));
  }

  useEffect(() => {
    if (!uid) return;
    reloadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, showArchived]);

  async function handleRename(classId: string) {
    const name = window.prompt('New class name?');
    if (!name) return;
    await api.renameClass(db, uid, classId, { name });
    reloadClasses();
  }

  async function handleArchive(classId: string, archived: boolean) {
    await api.archiveClass(db, uid, classId, archived);
    reloadClasses();
  }

  async function handleDeleteClass(classId: string, name: string) {
    const typed = window.prompt(
      `Permanently delete "${name}" and ALL its students and feedback history? This cannot be undone. Type the class name to confirm:`,
    );
    if (typed !== name) return;
    await api.deleteClass(db, uid, classId);
    if (activeClassId === classId) {
      setActiveClassId(null);
      setStudents([]);
    }
    reloadClasses();
  }

  async function handleEditStudent(studentId: string, patch: StudentEditPatch) {
    if (!activeClassId) return;
    await api.updateStudent(db, uid, activeClassId, studentId, patch);
    setStudents(await api.listStudents(db, uid, activeClassId));
  }

  async function handleRemoveStudent(studentId: string) {
    if (!activeClassId) return;
    await api.deleteStudent(db, uid, activeClassId, studentId);
    setStudents(await api.listStudents(db, uid, activeClassId));
  }

  async function handleCreate(meta: Omit<ClassMeta, 'id'>) {
    setError(null);
    try {
      const id = await api.createClass(db, uid, meta);
      setClasses((prev) => [...prev, { id, ...meta }]);
      setActiveClassId(id);
    } catch {
      setError('Could not create the class.');
    }
  }

  async function handleSelectClass(id: string) {
    setActiveClassId(id);
    setShowPreview(false);
    try {
      setStudents(await api.listStudents(db, uid, id));
    } catch {
      setError('Could not load students for that class.');
    }
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(parseRoster(String(reader.result ?? '')));
      setShowPreview(true);
    };
    reader.readAsText(file);
  }

  async function handleConfirmImport() {
    if (!activeClassId) return;
    setError(null);
    const toSave: Student[] = preview.students.map((s, i) => ({
      id: `import-${i}`,
      name: s.name,
      email: s.email,
      period: s.period,
    }));
    try {
      await api.saveStudents(db, uid, activeClassId, toSave);
      setShowPreview(false);
      setStudents(await api.listStudents(db, uid, activeClassId));
    } catch {
      setError('Could not save the imported students.');
    }
  }

  return (
    <main>
      <h1>Roster</h1>
      {error && <p role="alert">{error}</p>}

      <ClassesScreen classes={classes} onCreate={handleCreate} />

      {classes.length > 0 && (
        <section aria-label="Select a class">
          <h2>Choose a class to manage</h2>
          <label>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived classes
          </label>
          <ul>
            {classes.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={c.id === activeClassId}
                  onClick={() => handleSelectClass(c.id)}
                >
                  {c.name}
                  {c.archived ? ' (archived)' : ''}
                </button>{' '}
                <Link to={`/compose/${c.id}`}>Write feedback</Link>{' '}
                <button type="button" onClick={() => handleRename(c.id)}>
                  Rename
                </button>{' '}
                <button
                  type="button"
                  onClick={() => handleArchive(c.id, !c.archived)}
                >
                  {c.archived ? 'Unarchive' : 'Archive'}
                </button>{' '}
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleDeleteClass(c.id, c.name)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeClassId && !showPreview && (
        <section aria-label="Import a roster">
          <h2>Import students from CSV</h2>
          <label htmlFor="roster-csv">Upload a CSV (name, email, period)</label>
          <input id="roster-csv" type="file" accept=".csv,text/csv" onChange={handleFile} />
          <RosterTable
            students={students}
            onEditStudent={handleEditStudent}
            onRemoveStudent={handleRemoveStudent}
          />
        </section>
      )}

      {showPreview && (
        <ImportPreview
          result={preview}
          onConfirm={handleConfirmImport}
          onCancel={() => setShowPreview(false)}
        />
      )}
    </main>
  );
}
