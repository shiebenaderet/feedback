import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SendStepper } from './SendStepper';
import type { CopyPasteMessage } from './CopyPastePanel';

const messages: CopyPasteMessage[] = [
  { id: 'm1', name: 'Ada Lovelace', email: 'ada@school.edu', finalText: 'You did great, Ada.' },
  { id: 'm2', name: 'Carlos Diaz', email: 'carlos@school.edu', finalText: 'Strong work, Carlos.' },
  { id: 'm3', name: 'Mei Chen', email: 'mei@school.edu', finalText: 'Keep it up, Mei.' },
];

describe('SendStepper', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows the first student: name, email, and the full message', () => {
    render(<SendStepper messages={messages} sent={{}} onMarkSent={vi.fn()} onMarkAllSent={vi.fn()} />);
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@school.edu')).toBeInTheDocument();
    expect(screen.getByText(/You did great, Ada/)).toBeInTheDocument();
  });

  it('shows progress as N of total sent', () => {
    render(<SendStepper messages={messages} sent={{ m1: true }} onMarkSent={vi.fn()} onMarkAllSent={vi.fn()} />);
    expect(screen.getByText(/1 of 3 sent/i)).toBeInTheDocument();
  });

  it('copies the email body to the clipboard', () => {
    render(<SendStepper messages={messages} sent={{}} onMarkSent={vi.fn()} onMarkAllSent={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /copy email body/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('You did great, Ada.');
  });

  it('copies the email address to the clipboard', () => {
    render(<SendStepper messages={messages} sent={{}} onMarkSent={vi.fn()} onMarkAllSent={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /copy address/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ada@school.edu');
  });

  it('Mark sent & next marks the current student and advances', () => {
    const onMarkSent = vi.fn();
    render(<SendStepper messages={messages} sent={{}} onMarkSent={onMarkSent} onMarkAllSent={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /mark sent & next/i }));
    expect(onMarkSent).toHaveBeenCalledWith('m1');
    // advanced to the second student
    expect(screen.getByText('Carlos Diaz')).toBeInTheDocument();
  });

  it('Previous and Skip navigate without marking sent', () => {
    const onMarkSent = vi.fn();
    render(<SendStepper messages={messages} sent={{}} onMarkSent={onMarkSent} onMarkAllSent={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(screen.getByText('Carlos Diaz')).toBeInTheDocument();
    expect(onMarkSent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('clicking a jump chip navigates to that student', () => {
    render(<SendStepper messages={messages} sent={{}} onMarkSent={vi.fn()} onMarkAllSent={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Jump to Mei Chen' }));
    expect(screen.getByText(/Keep it up, Mei/)).toBeInTheDocument();
  });

  it('shows a sent indicator on the current student when already sent', () => {
    render(<SendStepper messages={messages} sent={{ m1: true }} onMarkSent={vi.fn()} onMarkAllSent={vi.fn()} />);
    expect(screen.getByText(/already sent/i)).toBeInTheDocument();
  });
});
