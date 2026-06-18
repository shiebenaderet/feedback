// src/review/ReviewScreen.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewScreen } from './ReviewScreen';

// ReviewMessage shape: { id, name, email, finalText }
const messages = [
  { id: 'm1', name: 'Ada', email: 'ada@school.edu', finalText: 'You did did great.' },
  { id: 'm2', name: 'Carlos', email: 'carlos@school.edu', finalText: 'You worked hard.' },
];

describe('ReviewScreen', () => {
  it('lists every student with name, email, and message text', () => {
    render(<ReviewScreen messages={messages} onConfirm={vi.fn()} />);
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('ada@school.edu')).toBeInTheDocument();
    expect(screen.getByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText(/You worked hard/)).toBeInTheDocument();
  });

  it('shows grammar flags for a message that has issues', () => {
    render(<ReviewScreen messages={messages} onConfirm={vi.fn()} />);
    // "did did" -> double-word flag surfaced on Ada's row
    expect(screen.getByText(/Repeated word: "did"/)).toBeInTheDocument();
  });

  it('requires an explicit confirm checkbox before enabling the confirm button', () => {
    const onConfirm = vi.fn();
    render(<ReviewScreen messages={messages} onConfirm={onConfirm} />);
    const button = screen.getByRole('button', { name: /confirm/i });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/reviewed all/i));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('flags a message with an unfilled {token} placeholder', () => {
    const msgs = [
      { id: 'm1', name: 'Ada', email: 'ada@school.edu', finalText: 'Great work on {topic}.' },
    ];
    render(<ReviewScreen messages={msgs} onConfirm={vi.fn()} />);
    expect(screen.getByText(/Unfilled blank — fill before sending/i)).toBeInTheDocument();
  });

  it('flags an empty (whitespace-only) message', () => {
    const msgs = [{ id: 'm1', name: 'Ada', email: 'ada@school.edu', finalText: '   ' }];
    render(<ReviewScreen messages={msgs} onConfirm={vi.fn()} />);
    expect(screen.getByText(/Empty message/i)).toBeInTheDocument();
  });

  it('shows a skipped-student banner listing roster students with no message', () => {
    render(
      <ReviewScreen messages={messages} onConfirm={vi.fn()} unmessagedNames={['Mei', 'Bo']} />,
    );
    expect(screen.getByText(/2 of 4 students have no message/i)).toBeInTheDocument();
    expect(screen.getByText(/Mei, Bo/)).toBeInTheDocument();
  });

  it('blocks confirm until acknowledged when roster students are skipped', () => {
    const onConfirm = vi.fn();
    render(
      <ReviewScreen messages={messages} onConfirm={onConfirm} unmessagedNames={['Mei']} />,
    );
    const button = screen.getByRole('button', { name: /confirm/i });

    // "reviewed all" alone is not enough while students are skipped
    fireEvent.click(screen.getByLabelText(/reviewed all/i));
    expect(button).toBeDisabled();

    // the skipped-student acknowledgement enables it
    fireEvent.click(screen.getByLabelText(/send anyway/i));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('requires a second acknowledgement before Confirm enables when issues exist', () => {
    const onConfirm = vi.fn();
    const msgs = [
      { id: 'm1', name: 'Ada', email: 'ada@school.edu', finalText: 'Great work on {topic}.' },
    ];
    render(<ReviewScreen messages={msgs} onConfirm={onConfirm} />);
    const button = screen.getByRole('button', { name: /confirm/i });

    // ticking only the first checkbox is not enough while issues exist
    fireEvent.click(screen.getByLabelText(/reviewed all/i));
    expect(button).toBeDisabled();

    // the second acknowledgement enables it
    fireEvent.click(screen.getByLabelText(/send anyway/i));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
