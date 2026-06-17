import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddCourseCard } from './AddCourseCard';

describe('AddCourseCard', () => {
  it('submits the course name with the checked periods (1–6) as {label, order}', () => {
    const onCreate = vi.fn();
    render(<AddCourseCard onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('Course name'), {
      target: { value: 'Biology' },
    });
    fireEvent.click(screen.getByLabelText('Period 1'));
    fireEvent.click(screen.getByLabelText('Period 3'));
    fireEvent.click(screen.getByRole('button', { name: /add course/i }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Biology',
      periods: [
        { label: 'Period 1', order: 1 },
        { label: 'Period 3', order: 3 },
      ],
    });
  });

  it('adds a custom period after the standard ones with the next order', () => {
    const onCreate = vi.fn();
    render(<AddCourseCard onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('Course name'), { target: { value: 'Seminar' } });
    fireEvent.click(screen.getByLabelText('Period 2'));
    fireEvent.change(screen.getByLabelText('Add custom period'), {
      target: { value: 'Advisory' },
    });
    fireEvent.click(screen.getByRole('button', { name: '+ Add custom period' }));
    fireEvent.click(screen.getByRole('button', { name: /add course/i }));

    expect(onCreate).toHaveBeenCalledWith({
      name: 'Seminar',
      periods: [
        { label: 'Period 2', order: 2 },
        { label: 'Advisory', order: 7 },
      ],
    });
  });

  it('does not submit without a course name', () => {
    const onCreate = vi.fn();
    render(<AddCourseCard onCreate={onCreate} />);
    fireEvent.click(screen.getByLabelText('Period 1'));
    fireEvent.click(screen.getByRole('button', { name: /add course/i }));
    expect(onCreate).not.toHaveBeenCalled();
  });
});
