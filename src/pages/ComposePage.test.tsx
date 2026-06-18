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
    // No existing draft by default → a fresh batch is created.
    findDraftBatch: vi.fn(async () => null),
    listMessages: vi.fn(async () => []),
  };
}

function renderAt(deps: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={['/course/co1/period/p4/compose']}>
      <Routes>
        <Route
          path="/course/:courseId/period/:periodId/compose"
          element={<ComposePage deps={deps as Parameters<typeof ComposePage>[0]['deps']} />}
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
    expect(await screen.findByRole('heading', { name: /Period 4/ })).toBeInTheDocument();
  });

  it('RESUMES an existing draft batch on reload instead of creating a new one', async () => {
    const deps = {
      ...makeDeps(),
      findDraftBatch: vi.fn(async () => ({
        id: 'existing-batch',
        yearId: 'y1',
        courseId: 'co1',
        periodId: 'p4',
        sharedHeader: 'Resumed header',
        status: 'draft' as const,
      })),
      listMessages: vi.fn(async () => [
        {
          studentId: 's1',
          name: 'Ana',
          usedEntries: ['e1'],
          slotValues: {},
          finalText: 'Great work',
          status: 'draft' as const,
        },
      ]),
    };
    renderAt(deps);
    await screen.findByText("Ana's message");
    // Reused the existing batch; did NOT create a new one (no orphaned drafts).
    expect(deps.findDraftBatch).toHaveBeenCalledWith({ __fake: true }, 'u1', 'p4');
    expect(deps.listMessages).toHaveBeenCalledWith({ __fake: true }, 'u1', 'existing-batch');
    expect(deps.createBatch).not.toHaveBeenCalled();
  });

  it('renders a per-student History link with the correct course/period/year href', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText("Ana's message");
    const link = screen.getByRole('link', { name: 'History for Ana' });
    expect(link).toHaveAttribute(
      'href',
      '/student/s1/history?year=y1&course=co1&period=p4',
    );
    expect(screen.getByRole('link', { name: 'History for Ben' })).toHaveAttribute(
      'href',
      '/student/s2/history?year=y1&course=co1&period=p4',
    );
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

  it('full round by default: no quick-round indicator, no targetStudentIds write', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText("Ana's message");
    expect(screen.queryByTestId('quick-round-indicator')).toBeNull();
    // updateBatch is only called for header persistence; never for targeting here.
    expect(deps.updateBatch).not.toHaveBeenCalled();
  });

  it('focuses a quick round on the selected subset and persists targetStudentIds', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText("Ana's message");
    await waitFor(() => expect(deps.createBatch).toHaveBeenCalled());

    // Select Ana for a quick round.
    fireEvent.click(screen.getByLabelText('Select Ana for quick round'));
    // The focus control appears once at least one student is selected.
    const focusBtn = screen.getByRole('button', { name: /Focus round on 1 selected/ });
    fireEvent.click(focusBtn);

    await waitFor(() =>
      expect(deps.updateBatch).toHaveBeenCalledWith({ __fake: true }, 'u1', 'batch-1', {
        targetStudentIds: ['s1'],
      }),
    );
    expect(screen.getByTestId('quick-round-indicator')).toHaveTextContent(
      'Quick round: 1 students',
    );
  });

  it('clearing a quick round resets targetStudentIds to empty (full round)', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText("Ana's message");
    await waitFor(() => expect(deps.createBatch).toHaveBeenCalled());

    fireEvent.click(screen.getByLabelText('Select Ben for quick round'));
    fireEvent.click(screen.getByRole('button', { name: /Focus round on 1 selected/ }));
    await waitFor(() => expect(screen.getByTestId('quick-round-indicator')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Clear quick round' }));
    await waitFor(() =>
      expect(deps.updateBatch).toHaveBeenLastCalledWith({ __fake: true }, 'u1', 'batch-1', {
        targetStudentIds: [],
      }),
    );
    expect(screen.queryByTestId('quick-round-indicator')).toBeNull();
  });

  it('resumes an active quick round from the batch (targetStudentIds restored)', async () => {
    const deps = {
      ...makeDeps(),
      findDraftBatch: vi.fn(async () => ({
        id: 'existing-batch',
        yearId: 'y1',
        courseId: 'co1',
        periodId: 'p4',
        sharedHeader: '',
        status: 'draft' as const,
        targetStudentIds: ['s2'],
      })),
    };
    renderAt(deps);
    await screen.findByText("Ana's message");
    expect(screen.getByTestId('quick-round-indicator')).toHaveTextContent(
      'Quick round: 1 students',
    );
  });
});
