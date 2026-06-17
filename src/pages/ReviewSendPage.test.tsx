import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } }),
}));
const { getTokenMock } = vi.hoisted(() => ({ getTokenMock: vi.fn() }));
vi.mock('../auth/gmailToken', () => ({ getGmailAccessToken: getTokenMock }));

import { ReviewSendPage } from './ReviewSendPage';

const batch = { id: 'b1', yearId: 'y1', courseId: 'c1', periodId: 'p1', sharedHeader: 'Q3', status: 'draft' as const };
const messages = [
  { studentId: 's1', name: 'Ana', usedEntries: [], slotValues: {}, finalText: 'Hi Ana', status: 'draft' as const },
];

function makeDeps(over: Partial<ReturnType<typeof base>> = {}) {
  return { ...base(), ...over };
}
function base() {
  return {
    getBatch: vi.fn(async () => batch),
    listMessages: vi.fn(async () => messages),
    listStudents: vi.fn(async () => [{ id: 's1', name: 'Ana', email: 'a@x.edu', period: '4' }]),
    setBatchStatus: vi.fn(async () => undefined),
    sendOne: vi.fn(async () => undefined), // stands in for createGmailSender's fn
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

describe('ReviewSendPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Mode A (token present): sends via runSend and flips batch to sent', async () => {
    getTokenMock.mockReturnValue('ya29.TOKEN');
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText('Hi Ana');
    fireEvent.click(screen.getByRole('button', { name: /send all/i }));
    await waitFor(() => expect(deps.sendOne).toHaveBeenCalledTimes(1));
    expect(deps.sendOne).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1', email: 'a@x.edu', finalText: 'Hi Ana' }),
    );
    await waitFor(() =>
      expect(deps.setBatchStatus).toHaveBeenCalledWith({ __fake: true }, 'u1', 'b1', 'sent'),
    );
  });

  it('Mode B (no token): reveals copy-paste, never calls the sender', async () => {
    getTokenMock.mockReturnValue(null);
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText('Hi Ana');
    fireEvent.click(screen.getByRole('button', { name: /send all/i }));
    expect(await screen.findByTestId('copy-paste-panel')).toBeInTheDocument();
    expect(deps.sendOne).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(deps.setBatchStatus).toHaveBeenCalledWith({ __fake: true }, 'u1', 'b1', 'sending'),
    );
  });
});
