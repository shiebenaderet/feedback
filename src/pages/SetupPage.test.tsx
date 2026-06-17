import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Course } from '../types';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'teacher-1', email: 't@x.edu' } }),
}));

import { SetupPage } from './SetupPage';

const courses: Course[] = [{ id: 'course-bio', name: 'Biology', archived: false }];

function makeDeps() {
  return {
    uid: 'teacher-1',
    yearId: 'year-2026',
    listCourses: vi.fn(async () => courses),
    createCourse: vi.fn(async () => 'course-new'),
    createPeriod: vi.fn(async () => 'period-new'),
    renameCourse: vi.fn(async () => {}),
    archiveCourse: vi.fn(async () => {}),
    deleteCourse: vi.fn(async () => {}),
  };
}

describe('SetupPage', () => {
  it('loads and lists existing courses', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter>
        <SetupPage deps={deps} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Biology')).toBeInTheDocument();
    expect(deps.listCourses).toHaveBeenCalledWith(
      { __fake: true },
      'teacher-1',
      'year-2026',
      undefined,
      { includeArchived: false },
    );
  });

  it('creating a course calls createCourse then createPeriod per checked period', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter>
        <SetupPage deps={deps} />
      </MemoryRouter>,
    );
    fireEvent.change(await screen.findByLabelText('Course name'), {
      target: { value: 'Chemistry' },
    });
    fireEvent.click(screen.getByLabelText('Period 1'));
    fireEvent.click(screen.getByLabelText('Period 2'));
    fireEvent.click(screen.getByRole('button', { name: /add course/i }));

    await waitFor(() =>
      expect(deps.createCourse).toHaveBeenCalledWith(
        { __fake: true },
        'teacher-1',
        'year-2026',
        'Chemistry',
      ),
    );
    await waitFor(() => expect(deps.createPeriod).toHaveBeenCalledTimes(2));
    expect(deps.createPeriod).toHaveBeenCalledWith(
      { __fake: true },
      'teacher-1',
      'year-2026',
      'course-new',
      { label: 'Period 1', order: 1 },
    );
    expect(deps.createPeriod).toHaveBeenCalledWith(
      { __fake: true },
      'teacher-1',
      'year-2026',
      'course-new',
      { label: 'Period 2', order: 2 },
    );
  });

  it('archives a course via its Archive button', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter>
        <SetupPage deps={deps} />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /^archive$/i }));
    await waitFor(() =>
      expect(deps.archiveCourse).toHaveBeenCalledWith(
        { __fake: true },
        'teacher-1',
        'year-2026',
        'course-bio',
        true,
      ),
    );
  });
});
