// src/pages/RosterPage.tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { listStudents, saveStudents, updateStudent, deleteStudent } from '../data/students';
import { getOrCreateCurrentYear } from '../data/years';
import { downloadRosterTemplate } from '../roster/downloadRosterTemplate';
import { UploadRosterPanel } from '../roster/UploadRosterPanel';
import { AddStudentForm, type NewStudentInput } from '../roster/AddStudentForm';
import { PasteRosterPanel } from '../roster/PasteRosterPanel';
import { ImportPreview } from '../roster/ImportPreview';
import { RosterTable, type RosterStudent } from '../roster/RosterTable';
import type { StudentEditPatch } from '../roster/StudentRowActions';
import { EMPTY_PARSE_RESULT, type ParseResult } from '../roster/types';
import type { Student } from '../types';
import { tokens, panelStyle } from '../ui/theme';

/**
 * The per-period Roster screen at /course/:courseId/period/:periodId/roster.
 * Loads the period roster, offers three cohesive entry methods (Upload CSV with
 * template download, Type manually, Paste a list), routes CSV + paste through the
 * shared ImportPreview, renders RosterTable with edit/remove, and links to the
 * period's compose route. Period-scoped data fns + the template download are injected
 * so the smoke test drives it without a backend.
 */
export interface RosterPageDeps {
  uid: string;
  yearId: string;
  listStudents: typeof listStudents;
  saveStudents: typeof saveStudents;
  updateStudent: typeof updateStudent;
  deleteStudent: typeof deleteStudent;
  downloadRosterTemplate: typeof downloadRosterTemplate;
}

/** The current academic-year label, e.g. "2025–26" (rolls over in August). */
function currentSchoolYearLabel(): string {
  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Map persisted Student[] to the RosterStudent[] shape the table renders. */
function toRosterStudents(students: Student[]): RosterStudent[] {
  return students.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    period: s.period ?? '',
  }));
}

export function RosterPage({ deps }: { deps?: Partial<RosterPageDeps> }) {
  const { user } = useAuth();
  const { courseId = '', periodId = '' } = useParams();
  const uid = deps?.uid ?? user?.uid ?? '';
  const api = {
    listStudents: deps?.listStudents ?? listStudents,
    saveStudents: deps?.saveStudents ?? saveStudents,
    updateStudent: deps?.updateStudent ?? updateStudent,
    deleteStudent: deps?.deleteStudent ?? deleteStudent,
    downloadRosterTemplate: deps?.downloadRosterTemplate ?? downloadRosterTemplate,
  };

  const [yearId, setYearId] = useState<string>(deps?.yearId ?? '');
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [preview, setPreview] = useState<ParseResult>(EMPTY_PARSE_RESULT);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the active year (the test injects deps.yearId, skipping this).
  useEffect(() => {
    if (!uid || yearId) return;
    getOrCreateCurrentYear(db, uid, currentSchoolYearLabel())
      .then(setYearId)
      .catch(() => setError('Could not load the current year.'));
  }, [uid, yearId]);

  async function reloadStudents() {
    try {
      setStudents(toRosterStudents(await api.listStudents(db, uid, yearId, courseId, periodId)));
    } catch {
      setError('Could not load this period’s roster.');
    }
  }

  useEffect(() => {
    if (!uid || !yearId || !courseId || !periodId) return;
    reloadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, yearId, courseId, periodId]);

  function handleParsed(result: ParseResult) {
    setPreview(result);
    setShowPreview(true);
  }

  async function persist(toSave: Student[]) {
    setError(null);
    try {
      await api.saveStudents(db, uid, yearId, courseId, periodId, toSave);
      await reloadStudents();
    } catch {
      setError('Could not save the students.');
    }
  }

  async function handleConfirmImport() {
    const toSave: Student[] = preview.students.map((s, i) => ({
      id: `import-${i}`,
      name: s.name,
      email: s.email,
      period: s.period,
    }));
    await persist(toSave);
    setShowPreview(false);
  }

  async function handleAddManual(input: NewStudentInput) {
    await persist([{ id: 'manual-0', name: input.name, email: input.email, period: '' }]);
  }

  async function handleEditStudent(studentId: string, patch: StudentEditPatch) {
    await api.updateStudent(db, uid, yearId, courseId, periodId, studentId, patch);
    await reloadStudents();
  }

  async function handleRemoveStudent(studentId: string) {
    await api.deleteStudent(db, uid, yearId, courseId, periodId, studentId);
    await reloadStudents();
  }

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: tokens.space(4) }}>
      <h1 style={{ color: tokens.color.text }}>Build the roster</h1>
      {error && (
        <p role="alert" style={{ color: tokens.color.danger }}>
          {error}
        </p>
      )}

      {!showPreview && (
        <div style={{ display: 'grid', gap: tokens.space(2) }}>
          <section aria-label="Upload CSV" style={panelStyle()}>
            <h2 style={{ color: tokens.color.text }}>Upload CSV</h2>
            <UploadRosterPanel
              onParsed={handleParsed}
              onDownloadTemplate={api.downloadRosterTemplate}
            />
          </section>

          <section aria-label="Type manually" style={panelStyle()}>
            <h2 style={{ color: tokens.color.text }}>Type manually</h2>
            <AddStudentForm onAdd={handleAddManual} />
          </section>

          <section aria-label="Paste a list" style={panelStyle()}>
            <h2 style={{ color: tokens.color.text }}>Paste a list</h2>
            <PasteRosterPanel onParsed={handleParsed} />
          </section>

          <section aria-label="Current roster" style={panelStyle()}>
            <h2 style={{ color: tokens.color.text }}>Current roster</h2>
            <RosterTable
              students={students}
              onEditStudent={handleEditStudent}
              onRemoveStudent={handleRemoveStudent}
            />
            <p style={{ marginTop: tokens.space(2) }}>
              <Link to={`/course/${courseId}/period/${periodId}/compose`}>
                Start writing feedback →
              </Link>
            </p>
          </section>
        </div>
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
