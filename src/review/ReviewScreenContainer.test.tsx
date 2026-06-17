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
});
