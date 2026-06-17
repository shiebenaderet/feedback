import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } }),
}));
vi.mock('../auth/authService', () => ({ signOutTeacher: vi.fn(() => Promise.resolve()) }));

import { BankPage, type BankPageDeps } from './BankPage';

function makeDeps(): Partial<BankPageDeps> {
  return {
    uid: 'u1',
    listBankEntries: vi.fn(async (_db: unknown, _uid: string) => [
      { id: 'e1', templateText: 'Great claim, {name}.', slots: [], tags: { type: 'success', area: 'cer', objective: '', tone: '' } },
    ]),
    addBankEntry: vi.fn(async (_db: unknown, _uid: string, _input: unknown) => 'e2'),
  };
}

describe('BankPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and lists the teacher’s bank entries', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter>
        <BankPage deps={deps} />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Great claim/)).toBeInTheDocument();
    expect(deps.listBankEntries).toHaveBeenCalledWith({ __fake: true }, 'u1');
  });

  it('adds a new comment via the form and reloads the list', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter>
        <BankPage deps={deps} />
      </MemoryRouter>,
    );
    await screen.findByText(/Great claim/);

    fireEvent.change(screen.getByLabelText(/template text/i), {
      target: { value: 'Keep it up, {name}.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save|add comment/i }));

    await waitFor(() => expect(deps.addBankEntry).toHaveBeenCalledTimes(1));
    const [, uid, input] = (deps.addBankEntry as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(uid).toBe('u1');
    expect(input.templateText).toBe('Keep it up, {name}.');
    // The list is reloaded after a successful add.
    expect(deps.listBankEntries).toHaveBeenCalledTimes(2);
  });
});
