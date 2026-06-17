import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { FeedbackHistoryEntry } from '../types';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } }),
}));
vi.mock('../auth/authService', () => ({ signOutTeacher: vi.fn(() => Promise.resolve()) }));

import { StudentHistoryPage, type StudentHistoryPageDeps } from './StudentHistoryPage';

const history: FeedbackHistoryEntry[] = [
  {
    id: 'h2', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
    sentAt: Date.UTC(2026, 0, 5, 15, 0, 0), gradingPeriod: 'Q2', label: 'Mid-year note',
    finalText: 'Keep it up, Ada.',
    tags: { areas: ['discussion'], sentiments: ['strength'], standards: [] },
    usedEntries: ['seed-discussion-success-1'],
  },
  {
    id: 'h1', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
    sentAt: Date.UTC(2025, 9, 12, 15, 0, 0), gradingPeriod: 'Q1',
    finalText: 'Strong quarter, Ada.',
    tags: { areas: ['cer'], sentiments: ['growth'], standards: [] },
    usedEntries: ['seed-cer-success-1'],
  },
];

function renderAt(deps: Partial<StudentHistoryPageDeps>) {
  return render(
    <MemoryRouter initialEntries={['/student/s1/history?year=y1&course=c1&period=p1']}>
      <Routes>
        <Route path="/student/:studentId/history" element={<StudentHistoryPage deps={deps} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StudentHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the student history for the location from the query string', async () => {
    const listStudentHistory = vi.fn(async () => history);
    renderAt({ listStudentHistory });
    await screen.findByText('Mid-year note', { exact: false });
    expect(listStudentHistory).toHaveBeenCalledWith({ __fake: true }, 'u1', {
      yearId: 'y1', courseId: 'c1', periodId: 'p1', studentId: 's1',
    });
  });

  it('renders entries chronologically, newest first, with dated summary and full text', async () => {
    const listStudentHistory = vi.fn(async () => history);
    renderAt({ listStudentHistory });
    const articles = await screen.findAllByRole('article');
    expect(articles).toHaveLength(2);
    expect(articles[0]).toHaveTextContent('Jan 5 · Q2 — Mid-year note');
    expect(articles[0]).toHaveTextContent('Keep it up, Ada.');
    expect(articles[1]).toHaveTextContent('Oct 12 · Q1');
    expect(articles[1]).toHaveTextContent('Strong quarter, Ada.');
  });

  it('shows an empty state when the student has no history', async () => {
    const listStudentHistory = vi.fn(async () => []);
    renderAt({ listStudentHistory });
    expect(await screen.findByText(/no feedback history yet/i)).toBeInTheDocument();
  });
});
