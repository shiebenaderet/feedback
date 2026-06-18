import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StandardsFeedbackPicker } from './StandardsFeedbackPicker';
import { LEVELED_COMMENTS, leveledComment } from '../standards/leveledComments';
import { labelForCode } from '../standards/standards';

describe('StandardsFeedbackPicker', () => {
  it('lists every standard in the bank by default', () => {
    render(<StandardsFeedbackPicker studentName="Ana G." onInsert={vi.fn()} />);
    const select = screen.getByTestId('standards-feedback-select') as HTMLSelectElement;
    const distinct = new Set(LEVELED_COMMENTS.map((c) => c.standardCode));
    expect(select.options.length).toBe(distinct.size);
  });

  it('restricts the dropdown to the supplied standardCodes', () => {
    const restricted = ['SSS4.6-8.1', 'H3.6-8.4'];
    render(
      <StandardsFeedbackPicker
        studentName="Ana G."
        onInsert={vi.fn()}
        standardCodes={restricted}
      />,
    );
    const select = screen.getByTestId('standards-feedback-select') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(restricted);
    // Each option is labeled via labelForCode.
    expect(screen.getByRole('option', { name: labelForCode('SSS4.6-8.1') })).toBeInTheDocument();
  });

  it('ignores supplied codes that have no leveled comments', () => {
    render(
      <StandardsFeedbackPicker
        studentName="Ana"
        onInsert={vi.fn()}
        // 'C1.6-8.1' has no leveled comment in the bank.
        standardCodes={['SSS4.6-8.1', 'C1.6-8.1']}
      />,
    );
    const select = screen.getByTestId('standards-feedback-select') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['SSS4.6-8.1']);
  });

  it('inserts the leveled comment for the restricted standard with {name} filled', () => {
    const onInsert = vi.fn();
    render(
      <StandardsFeedbackPicker
        studentName="Ana G."
        onInsert={onInsert}
        standardCodes={['SSS4.6-8.1']}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '3 Proficient' }));
    const comment = leveledComment('SSS4.6-8.1', 3)!;
    const expected = `${comment.text.replace('{name}', 'Ana')} ${comment.nextStep}`;
    expect(onInsert).toHaveBeenCalledWith(expected);
  });
});
