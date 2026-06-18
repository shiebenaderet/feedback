import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentTrajectoryView } from './StudentTrajectoryView';
import type { StudentTrajectory } from '../feedback/aggregateStudentTrajectories';

function traj(over: Partial<StudentTrajectory>): StudentTrajectory {
  return {
    studentId: 's1',
    name: 'Ada',
    total: 0,
    lastSentAt: null,
    daysSinceLast: null,
    countsByGradingPeriod: {},
    strengthCount: 0,
    growthCount: 0,
    topGrowthAreas: [],
    overdue: true,
    ...over,
  };
}

function renderView(trajectories: StudentTrajectory[]) {
  return render(
    <MemoryRouter>
      <StudentTrajectoryView
        trajectories={trajectories}
        yearId="y1"
        courseId="c1"
        periodId="p1"
      />
    </MemoryRouter>,
  );
}

const DAY = 24 * 60 * 60 * 1000;

describe('StudentTrajectoryView', () => {
  it('renders a row per student with name and feedback count', () => {
    renderView([
      traj({ studentId: 's1', name: 'Ada', total: 4, lastSentAt: 5 * DAY, daysSinceLast: 3, overdue: false }),
      traj({ studentId: 's2', name: 'Beto', total: 0 }),
    ]);
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Beto')).toBeInTheDocument();
  });

  it('shows "never" and a never-contacted chip for students with no history', () => {
    renderView([traj({ studentId: 's2', name: 'Beto', lastSentAt: null, overdue: true })]);
    expect(screen.getByText(/never contacted/i)).toBeInTheDocument();
    expect(screen.getByText('never')).toBeInTheDocument();
  });

  it('flags overdue (but contacted) students with an overdue chip', () => {
    renderView([
      traj({ studentId: 's1', name: 'Ada', total: 1, lastSentAt: 1 * DAY, daysSinceLast: 45, overdue: true }),
    ]);
    expect(screen.getByText(/^overdue$/i)).toBeInTheDocument();
  });

  it('does not flag a recently-contacted student', () => {
    renderView([
      traj({ studentId: 's1', name: 'Ada', total: 2, lastSentAt: 10 * DAY, daysSinceLast: 2, overdue: false }),
    ]);
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/never contacted/i)).not.toBeInTheDocument();
  });

  it('renders the compact per-grading-period arc', () => {
    renderView([
      traj({ studentId: 's1', name: 'Ada', total: 3, lastSentAt: 1 * DAY, daysSinceLast: 5, overdue: false, countsByGradingPeriod: { Q1: 2, Q2: 1 } }),
    ]);
    expect(screen.getByText('Q1:2')).toBeInTheDocument();
    expect(screen.getByText('Q2:1')).toBeInTheDocument();
  });

  it('shows strength/growth balance with an accessible label', () => {
    renderView([
      traj({ studentId: 's1', name: 'Ada', total: 5, lastSentAt: 1 * DAY, daysSinceLast: 5, overdue: false, strengthCount: 3, growthCount: 2 }),
    ]);
    expect(screen.getByLabelText('3 strength, 2 growth')).toBeInTheDocument();
  });

  it('links each row to the student history with year/course/period', () => {
    renderView([
      traj({ studentId: 's7', name: 'Ada', total: 1, lastSentAt: 1 * DAY, daysSinceLast: 5, overdue: false }),
    ]);
    const link = screen.getByRole('link', { name: /view history/i });
    expect(link).toHaveAttribute(
      'href',
      '/student/s7/history?year=y1&course=c1&period=p1',
    );
  });

  it('renders an empty state when there are no students', () => {
    renderView([]);
    expect(screen.getByText(/no students in this roster yet/i)).toBeInTheDocument();
  });

  it('uses table semantics within the region', () => {
    renderView([traj({ studentId: 's1', name: 'Ada' })]);
    const region = screen.getByRole('region', { name: /student trajectories/i });
    expect(within(region).getByRole('table')).toBeInTheDocument();
  });
});
