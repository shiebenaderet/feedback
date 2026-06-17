import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { BankEntry, FeedbackHistoryEntry } from '../types';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } }),
}));
vi.mock('../auth/authService', () => ({ signOutTeacher: vi.fn(() => Promise.resolve()) }));

import { TrendsPage, type TrendsPageDeps } from './TrendsPage';

const bank: BankEntry[] = [
  { id: 'b-success', templateText: '', slots: [], tags: { type: 'success', area: 'cer' } },
  { id: 'b-growth', templateText: '', slots: [], tags: { type: 'growth', area: 'discussion' } },
];
const periodHistory: FeedbackHistoryEntry[] = [
  { id: 'h1', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1', sentAt: 100, gradingPeriod: 'Q1', finalText: 'x', tags: { areas: ['cer'], sentiments: [], standards: [] }, usedEntries: ['b-success'] },
  { id: 'h2', studentId: 's2', periodId: 'p1', courseId: 'c1', yearId: 'y1', sentAt: 150, gradingPeriod: 'Q1', finalText: 'y', tags: { areas: ['discussion'], sentiments: [], standards: [] }, usedEntries: ['b-growth'] },
];

function makeDeps(over: Partial<TrendsPageDeps> = {}): Partial<TrendsPageDeps> {
  return {
    listPeriodHistory: vi.fn(async (_db: unknown, _uid: string, _periodId: string) => periodHistory),
    listCourseHistory: vi.fn(async (_db: unknown, _uid: string, _courseId: string) => periodHistory),
    listBank: vi.fn(async (_db: unknown, _uid: string) => bank),
    ...over,
  };
}

describe('TrendsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('period scope: loads period history + bank and renders the aggregated trends', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter initialEntries={['/course/c1/period/p1/trends']}>
        <Routes>
          <Route path="/course/:courseId/period/:periodId/trends" element={<TrendsPage deps={deps} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/2 pieces of feedback/i)).toBeInTheDocument();
    expect(deps.listPeriodHistory).toHaveBeenCalledWith({ __fake: true }, 'u1', 'p1');
    expect(deps.listCourseHistory).not.toHaveBeenCalled();
    // discussion entry derives growth → appears under top growth areas.
    const region = await screen.findByRole('region', { name: /top growth areas/i });
    expect(region).toHaveTextContent('discussion');
  });

  it('course scope: loads the course rollup instead', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter initialEntries={['/course/c1/trends']}>
        <Routes>
          <Route path="/course/:courseId/trends" element={<TrendsPage deps={deps} scope="course" />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText(/2 pieces of feedback/i);
    expect(deps.listCourseHistory).toHaveBeenCalledWith({ __fake: true }, 'u1', 'c1');
    expect(deps.listPeriodHistory).not.toHaveBeenCalled();
  });
});
