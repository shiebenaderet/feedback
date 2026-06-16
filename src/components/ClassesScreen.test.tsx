import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClassesScreen } from './ClassesScreen';
import type { ClassMeta } from '../types';

describe('ClassesScreen', () => {
  const classes: ClassMeta[] = [
    { id: 'class-a', name: 'Period 3 Biology', period: '3' },
    { id: 'class-b', name: 'Period 4 Chemistry', period: '4' },
  ];

  it('renders the class names', () => {
    render(<ClassesScreen classes={classes} onCreate={vi.fn()} />);
    expect(screen.getByText('Period 3 Biology')).toBeInTheDocument();
    expect(screen.getByText('Period 4 Chemistry')).toBeInTheDocument();
  });

  it('calls onCreate with the new-class form values', () => {
    const onCreate = vi.fn();
    render(<ClassesScreen classes={classes} onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('Class name'), {
      target: { value: 'Period 5 Physics' },
    });
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Semester'), { target: { value: 'Spring' } });
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'Motion' } });
    fireEvent.click(screen.getByRole('button', { name: 'New class' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Period 5 Physics',
      period: '5',
      semester: 'Spring',
      unit: 'Motion',
    });
  });
});
