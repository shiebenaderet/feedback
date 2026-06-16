// src/send/useSendRunner.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { MessageDraft } from '../types';
import { useSendRunner } from './useSendRunner';

// `send` (the function returned by createGmailSender, Task S6) is INJECTED into the
// hook, so we pass a vi.fn() directly — no gmailSender module mock, no `sendOne`.
// Only the real Google sign-in helper (Task F4) is module-mocked.
const send = vi.fn();
const signInWithGoogle = vi.fn();

vi.mock('../auth/authService', () => ({
  signInWithGoogle: (...a: unknown[]) => signInWithGoogle(...a),
}));

const drafts = (): MessageDraft[] => [
  { studentId: 's1', name: 'Ana', usedEntries: [], slotValues: {}, finalText: 'Hi Ana', status: 'draft' },
  { studentId: 's2', name: 'Ben', usedEntries: [], slotValues: {}, finalText: 'Hi Ben', status: 'draft' },
];

beforeEach(() => {
  send.mockReset();
  signInWithGoogle.mockReset();
});

describe('useSendRunner — re-auth on token expiry', () => {
  it('on a 401 it halts, surfaces re-auth (does NOT mark a message failed)', async () => {
    // First message: token expired (batch-wide auth error).
    send.mockRejectedValueOnce({ status: 401, message: 'Invalid Credentials' });

    const { result } = renderHook(() => useSendRunner(drafts(), send));
    await act(async () => { await result.current.start(); });

    await waitFor(() => expect(result.current.needsReauth).toBe(true));
    // Halted before the second message; nothing marked failed.
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.messages.every((m) => m.status === 'draft')).toBe(true);
    expect(result.current.failures).toHaveLength(0);
  });

  it('re-authorize re-runs signInWithGoogle, clears the prompt, and retries the batch', async () => {
    send.mockRejectedValueOnce({ status: 401 }); // first attempt: token expired
    signInWithGoogle.mockResolvedValueOnce({ uid: 'teacher-1' });
    send.mockResolvedValue({ id: 'gmail-msg' }); // after re-auth: all succeed

    const { result } = renderHook(() => useSendRunner(drafts(), send));
    await act(async () => { await result.current.start(); });
    await waitFor(() => expect(result.current.needsReauth).toBe(true));

    await act(async () => { await result.current.reauthorizeAndRetry(); });

    await waitFor(() => expect(result.current.needsReauth).toBe(false));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(result.current.messages.every((m) => m.status === 'sent')).toBe(true);
    expect(result.current.failures).toHaveLength(0);
  });

  it('a per-message (non-auth) failure marks that message failed and continues', async () => {
    send
      .mockRejectedValueOnce({ status: 400, message: 'Invalid To header' }) // s1: bad recipient
      .mockResolvedValueOnce({ id: 'gmail-msg' });                           // s2: ok

    const { result } = renderHook(() => useSendRunner(drafts(), send));
    await act(async () => { await result.current.start(); });

    await waitFor(() => expect(result.current.done).toBe(true));
    expect(result.current.needsReauth).toBe(false);
    expect(result.current.messages.find((m) => m.studentId === 's1')!.status).toBe('failed');
    expect(result.current.messages.find((m) => m.studentId === 's2')!.status).toBe('sent');
    expect(result.current.failures.map((m) => m.studentId)).toEqual(['s1']);
  });
});
