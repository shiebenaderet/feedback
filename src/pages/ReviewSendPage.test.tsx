import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } }),
}));
vi.mock('../auth/gmailToken', () => ({ getGmailAccessToken: () => null })); // → Mode B

import { ReviewSendPage } from './ReviewSendPage';

function makeDeps() {
  return {
    getBatch: vi.fn(async () => ({
      id: 'b1',
      periodId: 'p4',
      courseId: 'co1',
      yearId: 'y1',
      sharedHeader: 'Hi',
      status: 'draft' as const,
      gradingPeriod: 'Q1' as const,
      label: '',
    })),
    listMessages: vi.fn(async () => [
      { studentId: 's1', name: 'Ana', usedEntries: ['e1'], slotValues: {}, finalText: 'Hi Ana', status: 'draft' as const },
    ]),
    listStudents: vi.fn(async () => [
      { id: 's1', name: 'Ana', email: 'a@x.edu', period: 'Period 4' },
    ]),
    listBankEntries: vi.fn(async () => [
      { id: 'e1', templateText: 'x', slots: [], tags: { area: 'cer', type: 'success' } },
    ]),
    setBatchStatus: vi.fn(async () => {}),
    updateBatch: vi.fn(async () => {}),
    writeFeedbackHistory: vi.fn(async () => 'h1'),
  };
}

function renderAt(deps: ReturnType<typeof makeDeps>) {
  return render(
    <MemoryRouter initialEntries={['/review/b1']}>
      <Routes>
        <Route path="/review/:batchId" element={<ReviewSendPage deps={deps} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReviewSendPage (history + grading period)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the batch, roster from the period path, and the bank', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByRole('button', { name: 'Q1' });
    expect(deps.getBatch).toHaveBeenCalledWith({ __fake: true }, 'u1', 'b1');
    expect(deps.listStudents).toHaveBeenCalledWith({ __fake: true }, 'u1', 'y1', 'co1', 'p4');
    expect(deps.listBankEntries).toHaveBeenCalledWith({ __fake: true }, 'u1');
  });

  it('defaults the grading-period chooser from the batch and persists changes', async () => {
    const deps = makeDeps();
    renderAt(deps);
    // The batch's gradingPeriod (Q1) is the pressed chip on load.
    const q1 = await screen.findByRole('button', { name: 'Q1' });
    expect(q1).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Q2' }));
    await waitFor(() =>
      expect(deps.updateBatch).toHaveBeenCalledWith({ __fake: true }, 'u1', 'b1', {
        gradingPeriod: 'Q2',
        label: '',
      }),
    );
  });

  it('marking a student sent writes feedbackHistory with the batch context', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByRole('button', { name: 'Q1' });
    fireEvent.click(screen.getByRole('button', { name: /send all/i }));
    await waitFor(() => expect(screen.getByTestId('copy-paste-panel')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /mark sent & next/i }));

    await waitFor(() => expect(deps.writeFeedbackHistory).toHaveBeenCalledTimes(1));
    const call = deps.writeFeedbackHistory.mock.calls[0] as unknown as [
      unknown,
      string,
      {
        tree: { yearId: string; courseId: string; periodId: string };
        gradingPeriod: string;
        label: string;
        draft: { studentId: string };
        bankEntries: unknown[];
      },
    ];
    const [, uid, args] = call;
    expect(uid).toBe('u1');
    expect(args).toMatchObject({
      tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
      gradingPeriod: 'Q1',
      label: '',
    });
    expect(args.draft.studentId).toBe('s1');
    expect(args.bankEntries).toHaveLength(1);
  });
});
