import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Batch, MessageDraft } from '../types';
import { ReviewScreenContainer } from './ReviewScreenContainer';

function makeBatch(): Batch {
  return { id: 'b1', yearId: 'y1', courseId: 'c1', periodId: 'p1', sharedHeader: 'Hi', status: 'draft' };
}

function makeMessages(): MessageDraft[] {
  return [
    { studentId: 's1', name: 'Ana', usedEntries: ['e1'], slotValues: {}, finalText: 'Hi Ana', status: 'draft' },
    { studentId: 's2', name: 'Ben', usedEntries: ['e2'], slotValues: {}, finalText: 'Hi Ben', status: 'draft' },
  ];
}

describe('ReviewScreenContainer', () => {
  it('Mode A: confirm calls setBatchStatus("sending") then runSend, then setBatchStatus("sent")', async () => {
    const calls: string[] = [];
    const setBatchStatus = vi.fn(async (status: Batch['status']) => { calls.push('status:' + status); });
    const runSend = vi.fn(async (msgs: MessageDraft[], onProgress: (m: MessageDraft) => void) => {
      calls.push('runSend');
      const sent = msgs.map((m) => ({ ...m, status: 'sent' as const }));
      sent.forEach(onProgress);
      return sent;
    });

    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="A"
        runSend={runSend}
        setBatchStatus={setBatchStatus}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /send all/i }));

    await waitFor(() => expect(runSend).toHaveBeenCalledTimes(1));
    // ordering: status('sending') is set BEFORE runSend is invoked
    expect(calls).toEqual(['status:sending', 'runSend', 'status:sent']);
    // runSend received the batch's two messages
    expect(runSend.mock.calls[0][0]).toHaveLength(2);
    // live progress panel reflected the sent messages
    await waitFor(() => expect(screen.getByTestId('progress-sent-count').textContent).toBe('2'));
  });

  it('Mode B: confirm reveals copy-paste panel and never calls runSend', async () => {
    const setBatchStatus = vi.fn(async () => {});
    const runSend = vi.fn();

    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="B"
        runSend={runSend}
        setBatchStatus={setBatchStatus}
      />,
    );

    expect(screen.queryByTestId('copy-paste-panel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /send all/i }));

    await waitFor(() => expect(screen.getByTestId('copy-paste-panel')).toBeTruthy());
    expect(runSend).not.toHaveBeenCalled();
    expect(setBatchStatus).toHaveBeenCalledWith('sending');
  });

  it('Mode A: fires onSent once per message that resolves as sent', async () => {
    const onSent = vi.fn(async (_draft: MessageDraft) => {});
    const setBatchStatus = vi.fn(async () => {});
    const runSend = vi.fn(async (msgs: MessageDraft[], onProgress: (m: MessageDraft) => void) => {
      const sent = msgs.map((m) => ({ ...m, status: 'sent' as const }));
      sent.forEach(onProgress);
      return sent;
    });

    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="A"
        runSend={runSend}
        setBatchStatus={setBatchStatus}
        onSent={onSent}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /send all/i }));

    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(2));
    expect(onSent.mock.calls.map((c) => (c[0] as MessageDraft).studentId)).toEqual(['s1', 's2']);
    // failed messages must NOT write history.
  });

  it('Mode A: does not fire onSent for a message that failed', async () => {
    const onSent = vi.fn(async (_draft: MessageDraft) => {});
    const runSend = vi.fn(async (msgs: MessageDraft[], onProgress: (m: MessageDraft) => void) => {
      const results = msgs.map((m, i) => ({ ...m, status: (i === 0 ? 'failed' : 'sent') as MessageDraft['status'] }));
      results.forEach(onProgress);
      return results;
    });

    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="A"
        runSend={runSend}
        setBatchStatus={vi.fn(async () => {})}
        onSent={onSent}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /send all/i }));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect((onSent.mock.calls[0][0] as MessageDraft).studentId).toBe('s2');
  });

  it('Mode B: marking a student sent in the stepper writes that student to history', async () => {
    const onSent = vi.fn(async (_draft: MessageDraft) => {});
    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="B"
        runSend={vi.fn()}
        setBatchStatus={vi.fn(async () => {})}
        onSent={onSent}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /send all/i }));
    await waitFor(() => expect(screen.getByTestId('copy-paste-panel')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /mark sent & next/i }));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect((onSent.mock.calls[0][0] as MessageDraft).studentId).toBe('s1');
  });

  it('Mode B: marking all sent writes every student exactly once', async () => {
    const onSent = vi.fn(async (_draft: MessageDraft) => {});
    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="B"
        runSend={vi.fn()}
        setBatchStatus={vi.fn(async () => {})}
        onSent={onSent}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /send all/i }));
    await waitFor(() => expect(screen.getByTestId('copy-paste-panel')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /mark all sent/i }));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(2));
    expect(onSent.mock.calls.map((c) => (c[0] as MessageDraft).studentId).sort()).toEqual(['s1', 's2']);
  });

  it('Mode B: marking all sent flips the batch to "sent" (not stranded at "sending")', async () => {
    const setBatchStatus = vi.fn(async (_s: Batch['status']) => {});
    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="B"
        runSend={vi.fn()}
        setBatchStatus={setBatchStatus}
        onSent={vi.fn(async () => {})}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /send all/i }));
    await waitFor(() => expect(screen.getByTestId('copy-paste-panel')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /mark all sent/i }));
    await waitFor(() => expect(setBatchStatus).toHaveBeenCalledWith('sent'));
  });

  it('Mode B: marking each student sent in turn flips the batch to "sent" on the last one', async () => {
    const setBatchStatus = vi.fn(async (_s: Batch['status']) => {});
    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="B"
        runSend={vi.fn()}
        setBatchStatus={setBatchStatus}
        onSent={vi.fn(async () => {})}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /send all/i }));
    await waitFor(() => expect(screen.getByTestId('copy-paste-panel')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /mark sent & next/i })); // s1
    // Not done yet — only the 'sending' from confirm so far, no 'sent'.
    expect(setBatchStatus).not.toHaveBeenCalledWith('sent');
    fireEvent.click(screen.getByRole('button', { name: /mark sent & next/i })); // s2 (last)
    await waitFor(() => expect(setBatchStatus).toHaveBeenCalledWith('sent'));
  });

  it('Mode B: marking the same student sent twice writes history only once', async () => {
    const onSent = vi.fn(async (_draft: MessageDraft) => {});
    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="B"
        runSend={vi.fn()}
        setBatchStatus={vi.fn(async () => {})}
        onSent={onSent}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /send all/i }));
    await waitFor(() => expect(screen.getByTestId('copy-paste-panel')).toBeTruthy());

    // mark s1 sent, advance, go back, mark s1 again — history must not double-write.
    fireEvent.click(screen.getByRole('button', { name: /mark sent & next/i })); // s1
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    fireEvent.click(screen.getByRole('button', { name: /mark sent & next/i })); // s1 again
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
  });

});
