import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GradingPeriodChooser } from './GradingPeriodChooser';
import { GRADING_PERIODS } from '../feedback/taxonomy';

describe('GradingPeriodChooser', () => {
  it('renders one chip button per GRADING_PERIODS value', () => {
    render(
      <GradingPeriodChooser
        gradingPeriod={GRADING_PERIODS[0]}
        label=""
        onChange={vi.fn()}
      />,
    );
    for (const gp of GRADING_PERIODS) {
      expect(screen.getByRole('button', { name: gp })).toBeInTheDocument();
    }
  });

  it('marks the active grading period chip pressed', () => {
    render(<GradingPeriodChooser gradingPeriod="Q2" label="" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Q2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Q1' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the chosen grading period, preserving the label', () => {
    const onChange = vi.fn();
    render(
      <GradingPeriodChooser gradingPeriod="Q1" label="Unit 3" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Q2' }));
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
