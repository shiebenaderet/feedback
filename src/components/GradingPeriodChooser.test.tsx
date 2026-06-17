import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GradingPeriodChooser } from './GradingPeriodChooser';
import { GRADING_PERIODS } from '../feedback/taxonomy';

describe('GradingPeriodChooser', () => {
  it('renders one option per GRADING_PERIODS value', () => {
    render(
      <GradingPeriodChooser
        gradingPeriod={GRADING_PERIODS[0]}
        label=""
        onChange={vi.fn()}
      />,
    );
    const select = screen.getByLabelText(/grading period/i) as HTMLSelectElement;
    expect(select.options).toHaveLength(GRADING_PERIODS.length);
    for (const gp of GRADING_PERIODS) {
      expect(screen.getByRole('option', { name: gp })).toBeInTheDocument();
    }
  });

  it('reports the chosen grading period, preserving the label', () => {
    const onChange = vi.fn();
    render(
      <GradingPeriodChooser gradingPeriod="Q1" label="Unit 3" onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText(/grading period/i), {
      target: { value: 'Q2' },
    });
    expect(onChange).toHaveBeenCalledWith({ gradingPeriod: 'Q2', label: 'Unit 3' });
  });

  it('reports the typed label, preserving the grading period', () => {
    const onChange = vi.fn();
    render(<GradingPeriodChooser gradingPeriod="Q1" label="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/label/i), {
      target: { value: 'Unit 3 reflections' },
    });
    expect(onChange).toHaveBeenCalledWith({
      gradingPeriod: 'Q1',
      label: 'Unit 3 reflections',
    });
  });
});
