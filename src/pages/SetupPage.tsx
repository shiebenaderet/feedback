import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { getOrCreateCurrentYear } from '../data/years';
import { currentSchoolYearLabel } from '../data/currentSchoolYearLabel';
import { listCourses } from '../data/courses';
import { createCourse } from '../data/courses';
import { createPeriod } from '../data/periods';
import { renameCourse } from '../data/renameCourse';
import { archiveCourse } from '../data/renameCourse';
import { deleteCourse } from '../data/deleteCourse';
import { AddCourseCard, type NewCourseInput } from '../components/AddCourseCard';
import { NavBar } from '../components/NavBar';
import { Breadcrumbs } from '../components/Breadcrumbs';
import type { Course } from '../types';
import { tokens, cardStyle } from '../ui/theme';

/** Firestore/auth are injectable so the smoke test drives it without a backend. */
export interface SetupPageDeps {
  uid: string;
  yearId: string;
  listCourses: typeof listCourses;
  createCourse: typeof createCourse;
  createPeriod: typeof createPeriod;
  renameCourse: typeof renameCourse;
  archiveCourse: typeof archiveCourse;
  deleteCourse: typeof deleteCourse;
}

export function SetupPage({ deps }: { deps?: Partial<SetupPageDeps> }) {
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const api = {
    listCourses: deps?.listCourses ?? listCourses,
    createCourse: deps?.createCourse ?? createCourse,
    createPeriod: deps?.createPeriod ?? createPeriod,
    renameCourse: deps?.renameCourse ?? renameCourse,
    archiveCourse: deps?.archiveCourse ?? archiveCourse,
    deleteCourse: deps?.deleteCourse ?? deleteCourse,
  };

  const [yearId, setYearId] = useState<string>(deps?.yearId ?? '');
  const [showArchived, setShowArchived] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Resolve the current year on mount (Phase-1 getOrCreateCurrentYear); the test
  // injects yearId so this branch is skipped under the mock.
  useEffect(() => {
    if (!uid || yearId) return;
    getOrCreateCurrentYear(db, uid, currentSchoolYearLabel())
      .then((id) => setYearId(id))
      .catch(() => setError('Could not load the current year.'));
  }, [uid, yearId]);

  function reloadCourses(yId: string) {
    api
      .listCourses(db, uid, yId, undefined, { includeArchived: showArchived })
      .then(setCourses)
      .catch(() => setError('Could not load courses.'));
  }

  useEffect(() => {
    if (!uid || !yearId) return;
    reloadCourses(yearId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, yearId, showArchived]);

  async function handleCreateCourse(input: NewCourseInput) {
    setError(null);
    try {
      const courseId = await api.createCourse(db, uid, yearId, input.name);
      for (const p of input.periods) {
        await api.createPeriod(db, uid, yearId, courseId, { label: p.label, order: p.order });
      }
      reloadCourses(yearId);
    } catch {
      setError('Could not create the course.');
    }
  }

  async function handleRename(courseId: string) {
    const name = window.prompt('New course name?');
    if (!name) return;
    await api.renameCourse(db, uid, yearId, courseId, name);
    reloadCourses(yearId);
  }

  async function handleArchive(courseId: string, archived: boolean) {
    await api.archiveCourse(db, uid, yearId, courseId, archived);
    reloadCourses(yearId);
  }

  async function handleDelete(courseId: string, name: string) {
    const typed = window.prompt(
      `Permanently delete "${name}" and ALL its periods, students, and feedback history? This cannot be undone. Type the course name to confirm:`,
    );
    if (typed !== name) return;
    await api.deleteCourse(db, uid, yearId, courseId);
    reloadCourses(yearId);
  }

  return (
    <>
      <NavBar />
      <Breadcrumbs items={[{ label: 'Home', to: '/home' }, { label: 'Setup' }]} />
      <main style={{ maxWidth: 880, margin: '0 auto', padding: tokens.space(4) }}>
        <h1>Setup</h1>
        {error && <p role="alert">{error}</p>}

        <AddCourseCard onCreate={handleCreateCourse} />

        <section style={{ marginTop: tokens.space(4) }} aria-label="Your courses">
          <h2>Your courses</h2>
          <label>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived courses
          </label>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              display: 'grid',
              gap: tokens.space(1.5),
              marginTop: tokens.space(2),
            }}
          >
            {courses.map((c) => (
              <li
                key={c.id}
                style={{
                  ...cardStyle(),
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.space(1),
                  padding: tokens.space(2),
                }}
              >
                <span style={{ flex: 1, fontWeight: 600 }}>
                  {c.name}
                  {c.archived ? (
                    <span style={{ color: tokens.color.muted, fontWeight: 400 }}> (archived)</span>
                  ) : (
                    ''
                  )}
                </span>
                <button type="button" onClick={() => handleRename(c.id)}>
                  Rename
                </button>
                <button type="button" onClick={() => handleArchive(c.id, !c.archived)}>
                  {c.archived ? 'Unarchive' : 'Archive'}
                </button>
                <button type="button" className="danger" onClick={() => handleDelete(c.id, c.name)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
