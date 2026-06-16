// src/review/SendPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Batch } from '../types';
import { SendPanel } from './SendPanel';

// No module mock — the panel is pure UI. The container (Task S20) wires the real
// 4-arg setBatchStatus(db, uid, batchId, 'sending') from src/firebase/batches.ts
// (Task C21) into onResend. The panel only enforces the gate and calls onResend.
const draftBatch: Batch = { id: 'b1', classId: 'c1', sharedHeader: 'Hello', status: 'draft' };
const sentBatch: Batch = { id: 'b1', classId: 'c1', sharedHeader: 'Hello', status: 'sent' };

describe('SendPanel — double-send protection', () => {
  it('draft batch: primary Send is enabled and there is no re-send affordance', () => {
    render(<SendPanel batch={draftBatch} onSend={vi.fn()} onResend={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^send all$/i })).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: /send again/i })).toBeNull();
  });

  it("sent batch: primary Send is disabled and an explicit 'Send again' affordance is shown", () => {
    render(<SendPanel batch={sentBatch} onSend={vi.fn()} onResend={vi.fn()} />);
    const send = screen.getByRole('button', { name: /^send all$/i });
    expect(send).toBeDisabled();
    expect(screen.getByText(/already been sent/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send again/i })).toBeInTheDocument();
  });

  it("sent batch: 'Send again' gates re-send behind a confirm before invoking onResend", () => {
    const onResend = vi.fn();
    render(<SendPanel batch={sentBatch} onSend={vi.fn()} onResend={onResend} />);

    // First click reveals confirm; it does NOT re-send yet.
    fireEvent.click(screen.getByRole('button', { name: /send again/i }));
    expect(onResend).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: /yes, re-send/i });

    // Confirm: invokes onResend (the container flips status to 'sending' + sends).
    fireEvent.click(confirm);
    expect(onResend).toHaveBeenCalledTimes(1);
  });
});
