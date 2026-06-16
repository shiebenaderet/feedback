// src/compose/MessageBuilder.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageBuilder } from './MessageBuilder';

describe('MessageBuilder', () => {
  it('renders the shared header and a spellcheck-enabled editor with the current text', () => {
    render(
      <MessageBuilder
        studentName="Ana Diaz"
        header="Dear student,"
        finalText="Hi Ana Diaz"
        onTextChange={() => {}}
        onSaveAndNext={() => {}}
      />,
    );
    expect(screen.getByText('Dear student,')).toBeInTheDocument();
    const editor = screen.getByRole('textbox', { name: /message/i });
    expect(editor).toHaveValue('Hi Ana Diaz');
    expect(editor).toHaveAttribute('spellcheck', 'true');
  });

  it('shows whose message is being composed', () => {
    render(
      <MessageBuilder
        studentName="Ben Ng"
        header=""
        finalText=""
        onTextChange={() => {}}
        onSaveAndNext={() => {}}
      />,
    );
    expect(screen.getByText(/Ben Ng/)).toBeInTheDocument();
  });

  it('calls onTextChange with the new value as the teacher edits', () => {
    const onTextChange = vi.fn();
    render(
      <MessageBuilder
        studentName="Ana"
        header=""
        finalText="Hi"
        onTextChange={onTextChange}
        onSaveAndNext={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
      target: { value: 'Hi there' },
    });
    expect(onTextChange).toHaveBeenCalledWith('Hi there');
  });

  it('calls onSaveAndNext when the Save & next button is clicked', () => {
    const onSaveAndNext = vi.fn();
    render(
      <MessageBuilder
        studentName="Ana"
        header=""
        finalText="Hi"
        onTextChange={() => {}}
        onSaveAndNext={onSaveAndNext}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save & next/i }));
    expect(onSaveAndNext).toHaveBeenCalledTimes(1);
  });
});
