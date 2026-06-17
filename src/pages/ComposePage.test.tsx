import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } }),
}));

import { ComposePage } from './ComposePage';

function makeDeps() {
  return {
    resolveYearId: vi.fn(async () => 'y1'),
    loadComposeData: vi.fn(async () => ({
      period: { id: 'p4', label: 'Period 4', order: 4, courseId: 'co1', yearId: 'y1' },
      courseId: 'co1',
      yearId: 'y1',
      students: [
        { id: 's1', name: 'Ana', email: 'a@x.edu', period: 'Period 4' },
        { id: 's2', name: 'Ben', email: 'b@x.edu', period: 'Period 4' },
      ],
      entries: [{ id: 'e1', templateText: 'Great work {name}', slots: [], tags: {} }],
    })),
    createBatch: vi.fn(async () => 'batch-1'),
    updateBatch: vi.fn(async () => undefined),
    saveMessageDraft: vi.fn(async () => undefined),
  };
}

function renderAt(deps: ReturnType<typeof makeDeps>) {
  return render(
    <MemoryRouter initialEntries={['/course/co1/period/p4/compose']}>
      <Routes>
        <Route
          path="/course/:courseId/period/:periodId/compose"
          element={<ComposePage deps={deps} />}
        />
        <Route path="/review/:batchId" element={<div>review page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ComposePage (period route)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads period data and creates exactly one batch stamped with the tree ids', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText("Ana's message");
    expect(deps.loadComposeData).toHaveBeenCalledWith({ __fake: true }, 'u1', {
      yearId: 'y1',
      courseId: 'co1',
      periodId: 'p4',
    });
    await waitFor(() =>
      expect(deps.createBatch).toHaveBeenCalledWith({ __fake: true }, 'u1', {
        periodId: 'p4',
        courseId: 'co1',
        yearId: 'y1',
        sharedHeader: '',
      }),
    );
    expect(deps.createBatch).toHaveBeenCalledTimes(1);
  });

  it('shows the period name in the heading', async () => {
    const deps = makeDeps();
    renderAt(deps);
    expect(await screen.findByText(/Period 4/)).toBeInTheDocument();
  });

  it('auto-save persists a draft to the created batch', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText("Ana's message");
    fireEvent.click(await screen.findByTestId('add-e1'));
    await waitFor(
      () =>
        expect(deps.saveMessageDraft).toHaveBeenCalledWith(
          { __fake: true },
          'u1',
          'batch-1',
          expect.objectContaining({ studentId: 's1', status: 'draft' }),
        ),
      { timeout: 2000 },
    );
  });
});
