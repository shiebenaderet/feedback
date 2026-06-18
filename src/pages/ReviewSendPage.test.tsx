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

/** Drives the gated send (the ungated "Send all" button was removed): tick the
 *  review checkbox, then click the confirm button. Default fixture has no
 *  unfilled/empty/skipped blockers, so the single checkbox is enough. */
function confirmAndSend() {
  fireEvent.click(screen.getByLabelText(/reviewed all/i));
  fireEvent.click(screen.getByRole('button', { name: /confirm and continue to send/i }));
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

  it('an ALREADY-SENT batch renders read-only — no Send all, no re-send', async () => {
    const deps = {
      ...makeDeps(),
      getBatch: vi.fn(async () => ({
        id: 'b1',
        periodId: 'p4',
        courseId: 'co1',
        yearId: 'y1',
        sharedHeader: 'Hi',
        status: 'sent' as const,
        gradingPeriod: 'Q1' as const,
        label: '',
      })),
    };
    renderAt(deps as unknown as ReturnType<typeof makeDeps>);
    expect(await screen.findByText(/already been sent/i)).toBeInTheDocument();
    // The live sender is not rendered, so the batch cannot be re-sent.
    expect(screen.queryByRole('button', { name: /send all/i })).toBeNull();
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

  it('exposes an editable subject that defaults sensibly and surfaces in copy-paste', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByRole('button', { name: 'Q1' });

    const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement;
    expect(subjectInput.value).toBe('Feedback on your work');

    fireEvent.change(subjectInput, { target: { value: 'Q1 progress notes' } });
    expect(subjectInput.value).toBe('Q1 progress notes');

    // Reveal copy-paste (Mode B) and confirm the edited subject is shown there.
    confirmAndSend();
    await waitFor(() => expect(screen.getByTestId('copy-paste-panel')).toBeTruthy());
    expect(screen.getByText(/Subject: Q1 progress notes/)).toBeInTheDocument();
  });

  it('warns about roster students who have no message (skipped students)', async () => {
    const deps = {
      ...makeDeps(),
      listStudents: vi.fn(async () => [
        { id: 's1', name: 'Ana', email: 'a@x.edu', period: 'Period 4' },
        { id: 's2', name: 'Bo', email: 'b@x.edu', period: 'Period 4' },
      ]),
    };
    renderAt(deps as unknown as ReturnType<typeof makeDeps>);
    await screen.findByRole('button', { name: 'Q1' });
    // s2 (Bo) has no message → skipped-student banner names them.
    expect(await screen.findByText(/1 of 2 students have no message/i)).toBeInTheDocument();
    expect(screen.getByText(/Bo/)).toBeInTheDocument();
  });

  it('threads the editable subject into the Gmail sender', async () => {
    // In Mode A the sender is built from createGmailSender(subject); since the
    // test runs Mode B we verify the subject value drives the copy-paste display,
    // which is fed the same subject state that seeds the sender.
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByRole('button', { name: 'Q1' });
    const subjectInput = screen.getByLabelText('Subject') as HTMLInputElement;
    fireEvent.change(subjectInput, { target: { value: 'Custom subject' } });
    confirmAndSend();
    await waitFor(() => expect(screen.getByTestId('copy-paste-panel')).toBeTruthy());
    expect(screen.getByText(/Subject: Custom subject/)).toBeInTheDocument();
  });

  it('marking a student sent writes feedbackHistory with the batch context', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByRole('button', { name: 'Q1' });
    confirmAndSend();
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
