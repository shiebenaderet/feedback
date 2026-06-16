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
});
