// src/send/SendProgressPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SendProgressPanel } from './SendProgressPanel';

// SendState shape from batchSendMachine:
// { order, statuses, errors, phase }
const baseState = {
  order: ['m1', 'm2', 'm3'],
  statuses: { m1: 'sent', m2: 'failed', m3: 'pending' } as const,
  errors: { m2: 'quota exceeded' },
  phase: 'running' as const,
};

// Lookup for names/emails by id.
const names = {
  m1: { name: 'Ada', email: 'ada@school.edu' },
  m2: { name: 'Carlos', email: 'carlos@school.edu' },
  m3: { name: 'Mei', email: 'mei@school.edu' },
};

describe('SendProgressPanel', () => {
  it('shows progress as done/total', () => {
    render(<SendProgressPanel state={baseState} names={names} onRetry={vi.fn()} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '2'); // sent + failed
    expect(bar).toHaveAttribute('aria-valuemax', '3');
    expect(screen.getByText(/2 of 3/)).toBeInTheDocument();
  });

  it('lists failed messages with their error and a retry button', () => {
    const onRetry = vi.fn();
    render(<SendProgressPanel state={baseState} names={names} onRetry={onRetry} />);
    expect(screen.getByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText(/quota exceeded/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry failed/i }));
    expect(onRetry).toHaveBeenCalledWith(['m2']);
  });

  it('hides the retry button when there are no failures', () => {
    const cleanState = {
      ...baseState,
      statuses: { m1: 'sent', m2: 'sent', m3: 'sent' } as const,
      errors: {},
      phase: 'done' as const,
    };
    render(<SendProgressPanel state={cleanState} names={names} onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /retry failed/i })).toBeNull();
  });
});
