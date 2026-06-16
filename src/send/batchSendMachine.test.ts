// src/send/batchSendMachine.test.ts
import { describe, it, expect } from 'vitest';
import {
  createSendState,
  markSent,
  markFailed,
  type SendState,
} from './batchSendMachine';

// Minimal message shape the machine needs (snapshot of Firestore `messages`):
// { id: string; email: string; finalText: string }
const msgs = [
  { id: 'm1', email: 'a@x.com', finalText: 'Hi A' },
  { id: 'm2', email: 'b@x.com', finalText: 'Hi B' },
  { id: 'm3', email: 'c@x.com', finalText: 'Hi C' },
];

describe('createSendState', () => {
  it('starts every message as pending', () => {
    const state = createSendState(msgs);
    expect(state.statuses).toEqual({ m1: 'pending', m2: 'pending', m3: 'pending' });
    expect(state.phase).toBe('idle');
  });
});

describe('markSent / markFailed', () => {
  it('marks one message sent without touching others', () => {
    let state: SendState = createSendState(msgs);
    state = markSent(state, 'm2');
    expect(state.statuses).toEqual({ m1: 'pending', m2: 'sent', m3: 'pending' });
  });

  it('records a failure reason and leaves others untouched', () => {
    let state: SendState = createSendState(msgs);
    state = markFailed(state, 'm1', 'token expired');
    expect(state.statuses.m1).toBe('failed');
    expect(state.errors.m1).toBe('token expired');
    expect(state.statuses.m2).toBe('pending');
  });

  it('treats marking as immutable (returns a new object)', () => {
    const state = createSendState(msgs);
    const next = markSent(state, 'm1');
    expect(next).not.toBe(state);
    expect(state.statuses.m1).toBe('pending'); // original unchanged
  });
});
