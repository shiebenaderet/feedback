import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Assignment, Period } from '../types';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } }),
}));
vi.mock('../auth/authService', () => ({ signOutTeacher: vi.fn(() => Promise.resolve()) }));

import { AssignmentsPage } from './AssignmentsPage';

const periods: Period[] = [
  { id: 'p1', label: 'Period 1', order: 1 },
  { id: 'p2', label: 'Period 2', order: 2 },
];

const existing: Assignment[] = [
  {
    id: 'a1',
    yearId: 'y1',
    courseId: 'co1',
    title: 'Revolution DBQ',
    standardCodes: ['SSS4.6-8.1'],
    summative: true,
    periodIds: ['p1'],
    createdAt: 2,
  },
];

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    resolveYearId: vi.fn(async () => 'y1'),
    listAssignments: vi.fn(async () => existing),
    listPeriods: vi.fn(async () => periods),
    createAssignment: vi.fn(async () => 'new-a'),
    deleteAssignment: vi.fn(async () => undefined),
    ...overrides,
  };
}

function renderAt(deps: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={['/course/co1/assignments']}>
      <Routes>
        <Route
          path="/course/:courseId/assignments"
          element={
            <AssignmentsPage deps={deps as Parameters<typeof AssignmentsPage>[0]['deps']} />
          }
        />
        <Route
          path="/course/:courseId/assignment/:assignmentId"
          element={<div>feedback page</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AssignmentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists assignments from the injected listAssignments', async () => {
    const deps = makeDeps();
    renderAt(deps);
    expect(await screen.findByText('Revolution DBQ')).toBeInTheDocument();
    expect(deps.listAssignments).toHaveBeenCalledWith({ __fake: true }, 'u1', 'y1', 'co1');
    // Summative badge + linked standard code chip render.
    expect(screen.getByTestId('summative-a1')).toBeInTheDocument();
    expect(screen.getByText('SSS4.6-8.1')).toBeInTheDocument();
  });

  it('links each assignment to its feedback companion', async () => {
    renderAt(makeDeps());
    const link = await screen.findByRole('link', { name: 'Revolution DBQ' });
    expect(link).toHaveAttribute('href', '/course/co1/assignment/a1');
  });

  it('submitting the form calls createAssignment with title, standards, and periods', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText('Revolution DBQ');

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'New Quiz' },
    });
    // Pick a period.
    fireEvent.click(screen.getByLabelText('Period Period 2'));
    // Pick a standard (labelForCode is the checkbox aria-label).
    const { labelForCode } = await import('../standards/standards');
    fireEvent.click(screen.getByLabelText(labelForCode('SSS4.6-8.1')));

    fireEvent.click(screen.getByRole('button', { name: /create assignment/i }));

    await waitFor(() =>
      expect(deps.createAssignment).toHaveBeenCalledWith(
        { __fake: true },
        'u1',
        'y1',
        'co1',
        {
          title: 'New Quiz',
          standardCodes: ['SSS4.6-8.1'],
          summative: true,
          periodIds: ['p2'],
        },
      ),
    );
    // Refreshes the list after create.
    expect(deps.listAssignments).toHaveBeenCalledTimes(2);
  });

  it('deletes an assignment', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText('Revolution DBQ');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Revolution DBQ' }));
    await waitFor(() =>
      expect(deps.deleteAssignment).toHaveBeenCalledWith(
        { __fake: true },
        'u1',
        'y1',
        'co1',
        'a1',
      ),
    );
  });
});
