// src/send/CopyPastePanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CopyPastePanel } from './CopyPastePanel';

const messages = [
  { id: 'm1', name: 'Ada', email: 'ada@school.edu', finalText: 'You did great.' },
  { id: 'm2', name: 'Carlos', email: 'carlos@school.edu', finalText: 'You worked hard.' },
];

describe('CopyPastePanel', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders a Copy button and email for each message', () => {
    render(<CopyPastePanel messages={messages} sent={{}} onMarkSent={vi.fn()} onMarkAllSent={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /^copy$/i })).toHaveLength(2);
    expect(screen.getByText('ada@school.edu')).toBeInTheDocument();
  });

  it('copies the message text to the clipboard', async () => {
    render(<CopyPastePanel messages={messages} sent={{}} onMarkSent={vi.fn()} onMarkAllSent={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^copy$/i })[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('You did great.');
  });

  it('marks an individual message as sent', () => {
    const onMarkSent = vi.fn();
    render(<CopyPastePanel messages={messages} sent={{}} onMarkSent={onMarkSent} onMarkAllSent={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: /mark as sent/i })[1]);
    expect(onMarkSent).toHaveBeenCalledWith('m2');
  });

  it('marks all messages as sent', () => {
    const onMarkAllSent = vi.fn();
    render(<CopyPastePanel messages={messages} sent={{}} onMarkSent={vi.fn()} onMarkAllSent={onMarkAllSent} />);
    fireEvent.click(screen.getByRole('button', { name: /mark all sent/i }));
    expect(onMarkAllSent).toHaveBeenCalledTimes(1);
  });

  it('shows a sent indicator for already-sent messages', () => {
    render(<CopyPastePanel messages={messages} sent={{ m1: true }} onMarkSent={vi.fn()} onMarkAllSent={vi.fn()} />);
    // Ada (m1) is sent → her row carries the "Ada sent" labeled indicator; Carlos has none.
    expect(screen.getByLabelText('Ada sent')).toBeInTheDocument();
    expect(screen.queryByLabelText('Carlos sent')).toBeNull();
  });
});
