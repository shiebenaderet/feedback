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
    loadComposeData: vi.fn(async () => ({
      classMeta: { id: 'c1', name: 'Period 4', semester: 'S2' },
      students: [
        { id: 's1', name: 'Ana', email: 'a@x.edu', period: '4' },
        { id: 's2', name: 'Ben', email: 'b@x.edu', period: '4' },
      ],
      entries: [{ id: 'e1', templateText: 'Great work {name}', slots: [], tags: {} }],
    })),
    createBatch: vi.fn(async () => 'batch-1'),
    saveMessageDraft: vi.fn(async () => undefined),
  };
}

function renderAt(deps: ReturnType<typeof makeDeps>) {
  return render(
    <MemoryRouter initialEntries={['/compose/c1']}>
      <Routes>
        <Route path="/compose/:classId" element={<ComposePage deps={deps} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ComposePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads data and creates exactly one batch', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText("Ana's message");
    expect(deps.loadComposeData).toHaveBeenCalledWith({ __fake: true }, 'u1', 'c1');
    await waitFor(() =>
      expect(deps.createBatch).toHaveBeenCalledWith({ __fake: true }, 'u1', {
        yearId: 'c1',
        courseId: 'c1',
        periodId: 'c1',
        sharedHeader: '',
      }),
    );
    expect(deps.createBatch).toHaveBeenCalledTimes(1);
  });

  it('shows the roster with progress and advances on Save & next', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText("Ana's message");
    // progress indicator present (0 of 2 done initially)
    expect(screen.getByTestId('roster-progress')).toHaveTextContent('0 / 2');
    fireEvent.click(screen.getByRole('button', { name: /save & next/i }));
    expect(await screen.findByText("Ben's message")).toBeInTheDocument();
  });

  it('auto-save persists a draft via saveMessageDraft to the created batch', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText("Ana's message");
    fireEvent.click(await screen.findByTestId('add-e1')); // touches the message
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
