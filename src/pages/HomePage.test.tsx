import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Course, Period } from '../types';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'teacher-1', email: 't@x.edu' } }),
}));
vi.mock('../auth/authService', () => ({ signOutTeacher: vi.fn(() => Promise.resolve()) }));

import HomePage, { type HomePageDeps } from './HomePage';

const courses: Course[] = [{ id: 'course-bio', name: 'Biology', archived: false }];
const periods: Period[] = [{ id: 'p1', label: 'Period 1', order: 1 }];

function makeDeps(): Partial<HomePageDeps> {
  return {
    uid: 'teacher-1',
    yearId: 'year-2026',
    gradingPeriod: 'Q1',
    listCourses: vi.fn(async () => courses),
    listPeriods: vi.fn(async () => periods),
    rosterSize: vi.fn(async () => 3),
    listFeedbackHistory: vi.fn(async () => [
      {
        studentId: 's1',
        periodId: 'p1',
        courseId: 'course-bio',
        yearId: 'year-2026',
        sentAt: 1,
        gradingPeriod: 'Q1' as const,
        finalText: 'x',
        tags: { areas: [], sentiments: [], standards: [] },
        usedEntries: [],
      },
    ]),
  };
}

describe('HomePage', () => {
  it('greets the signed-in teacher', async () => {
    render(
      <MemoryRouter>
        <HomePage deps={makeDeps()} />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/t@x.edu/)).toBeInTheDocument();
  });

  it('renders a course card with each period and its feedback progress', async () => {
    render(
      <MemoryRouter>
        <HomePage deps={makeDeps()} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Biology')).toBeInTheDocument();
    expect(await screen.findByText('Period 1')).toBeInTheDocument();
    // 1 of 3 students have Q1 feedback.
    await waitFor(() => expect(screen.getByText('1 / 3')).toBeInTheDocument());
  });

  it('still renders the dashboard when the feedback-history read fails (degrades to 0 done)', async () => {
    const deps = {
      ...makeDeps(),
      // Simulates a missing composite index / permission hiccup on the history read.
      listFeedbackHistory: vi.fn(async () => {
        throw new Error('failed-precondition: index required');
      }),
    };
    render(
      <MemoryRouter>
        <HomePage deps={deps} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Biology')).toBeInTheDocument();
    // The card survives: progress shows 0 of 3 rather than the whole page erroring.
    await waitFor(() => expect(screen.getByText('0 / 3')).toBeInTheDocument());
    expect(screen.queryByText(/could not load your courses/i)).toBeNull();
  });

  it('links a populated period to its Roster and Write feedback', async () => {
    render(
      <MemoryRouter>
        <HomePage deps={makeDeps()} />
      </MemoryRouter>,
    );
    const roster = await screen.findByRole('link', { name: /^roster$/i });
    const write = await screen.findByRole('link', { name: /write feedback/i });
    const trends = await screen.findByRole('link', { name: /^trends$/i });
    expect(roster).toHaveAttribute('href', '/course/course-bio/period/p1/roster');
    expect(write).toHaveAttribute('href', '/course/course-bio/period/p1/compose');
    expect(trends).toHaveAttribute('href', '/course/course-bio/period/p1/trends');
  });

  it('an empty-roster period surfaces "Add students" pointing at the roster', async () => {
    const deps = { ...makeDeps(), rosterSize: vi.fn(async () => 0) };
    render(
      <MemoryRouter>
        <HomePage deps={deps} />
      </MemoryRouter>,
    );
    const add = await screen.findByRole('link', { name: /add students/i });
    expect(add).toHaveAttribute('href', '/course/course-bio/period/p1/roster');
    // With no students there is nothing to write yet — no compose link.
    expect(screen.queryByRole('link', { name: /write feedback/i })).toBeNull();
  });

  it('a course with no periods shows an empty state linking to setup', async () => {
    const deps = { ...makeDeps(), listPeriods: vi.fn(async () => []) };
    render(
      <MemoryRouter>
        <HomePage deps={deps} />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/no periods yet/i)).toBeInTheDocument();
  });

  it('shows an + Add course card linking to /setup', async () => {
    render(
      <MemoryRouter>
        <HomePage deps={makeDeps()} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: /add course/i })).toHaveAttribute('href', '/setup');
  });
});
