// src/pages/RosterPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { RosterStudent } from '../roster/RosterTable';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'teacher-1', email: 't@x.edu' } }),
}));

import { RosterPage } from './RosterPage';

const studentsInPeriod: RosterStudent[] = [
  { id: 's1', name: 'Ada Lovelace', email: 'ada@x.edu', period: 'Period 4' },
];

function makeDeps() {
  return {
    uid: 'teacher-1',
    yearId: 'year-2026',
    listStudents: vi.fn(async () => studentsInPeriod),
    saveStudents: vi.fn(async () => 1),
    updateStudent: vi.fn(async () => {}),
    deleteStudent: vi.fn(async () => {}),
    downloadRosterTemplate: vi.fn(),
  };
}

function renderAt(deps: ReturnType<typeof makeDeps>) {
  return render(
    <MemoryRouter initialEntries={['/course/course-a/period/period-3/roster']}>
      <Routes>
        <Route
          path="/course/:courseId/period/:periodId/roster"
          element={<RosterPage deps={deps} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RosterPage (per period)', () => {
  it('loads the period roster from the route params on mount', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await waitFor(() =>
      expect(deps.listStudents).toHaveBeenCalledWith(
        { __fake: true },
        'teacher-1',
        'year-2026',
        'course-a',
        'period-3',
      ),
    );
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('shows all three entry methods together', async () => {
    const deps = makeDeps();
    renderAt(deps);
    expect(await screen.findByRole('button', { name: /download template/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add student' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /parse & add/i })).toBeInTheDocument();
  });

  it('"Download template" triggers the injected download fn', async () => {
    const deps = makeDeps();
    renderAt(deps);
    fireEvent.click(await screen.findByRole('button', { name: /download template/i }));
    expect(deps.downloadRosterTemplate).toHaveBeenCalledTimes(1);
  });

  it('manual add saves one student to the period then reloads', async () => {
    const deps = makeDeps();
    renderAt(deps);
    fireEvent.change(await screen.findByLabelText('Student name'), {
      target: { value: 'Grace Hopper' },
    });
    fireEvent.change(screen.getByLabelText('Student email'), {
      target: { value: 'grace@x.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add student' }));
    await waitFor(() =>
      expect(deps.saveStudents).toHaveBeenCalledWith(
        { __fake: true },
        'teacher-1',
        'year-2026',
        'course-a',
        'period-3',
        [expect.objectContaining({ name: 'Grace Hopper', email: 'grace@x.edu' })],
      ),
    );
    // Reloads the roster after saving.
    expect(deps.listStudents).toHaveBeenCalledTimes(2);
  });

  it('paste → preview → confirm saves the parsed students to the period', async () => {
    const deps = makeDeps();
    renderAt(deps);
    fireEvent.change(await screen.findByLabelText(/one student per line/i), {
      target: { value: 'Grace Hopper, grace@x.edu\nKaty Bell, katy@x.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /parse & add/i }));
    // Shared ImportPreview appears with the found count, then confirm writes.
    fireEvent.click(await screen.findByRole('button', { name: /import 2 students/i }));
    await waitFor(() =>
      expect(deps.saveStudents).toHaveBeenCalledWith(
        { __fake: true },
        'teacher-1',
        'year-2026',
        'course-a',
        'period-3',
        [
          expect.objectContaining({ name: 'Grace Hopper', email: 'grace@x.edu' }),
          expect.objectContaining({ name: 'Katy Bell', email: 'katy@x.edu' }),
        ],
      ),
    );
  });

  it('editing a student patches it under the period', async () => {
    const deps = makeDeps();
    renderAt(deps);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(deps.updateStudent).toHaveBeenCalledWith(
        { __fake: true },
        'teacher-1',
        'year-2026',
        'course-a',
        'period-3',
        's1',
        expect.objectContaining({ name: 'Ada Lovelace', email: 'ada@x.edu' }),
      ),
    );
  });

  it('shows a "Start writing feedback →" link to the period compose route', async () => {
    const deps = makeDeps();
    renderAt(deps);
    const link = await screen.findByRole('link', { name: /start writing feedback/i });
    expect(link).toHaveAttribute('href', '/course/course-a/period/period-3/compose');
  });
});
