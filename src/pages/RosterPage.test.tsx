import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ClassMeta } from '../types';
import type { RosterStudent } from '../roster/RosterTable';

// No real Firebase, no real auth.
vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'teacher-1', email: 't@x.edu' } }),
}));

import { RosterPage } from './RosterPage';

const classes: ClassMeta[] = [{ id: 'class-a', name: 'Period 4 U.S. History', period: '4' }];
const studentsInClass: RosterStudent[] = [
  { id: 's1', name: 'Ada Lovelace', email: 'ada@x.edu', period: '4' },
];

function makeDeps() {
  return {
    uid: 'teacher-1',
    listClasses: vi.fn(async () => classes),
    createClass: vi.fn(async () => 'class-new'),
    saveStudents: vi.fn(async () => 1),
    listStudents: vi.fn(async () => studentsInClass),
  };
}

describe('RosterPage', () => {
  it('loads and lists the teacher’s classes', async () => {
    const deps = makeDeps();
    render(<RosterPage deps={deps} />);
    // The class appears as a selectable button in the "choose a class" list.
    expect(
      await screen.findByRole('button', { name: 'Period 4 U.S. History' }),
    ).toBeInTheDocument();
    expect(deps.listClasses).toHaveBeenCalledWith({ __fake: true }, 'teacher-1');
  });

  it('selecting a class loads its students into the roster table', async () => {
    const deps = makeDeps();
    render(<RosterPage deps={deps} />);
    // Click the class button (the one inside the select-a-class list).
    const classButton = await screen.findByRole('button', {
      name: 'Period 4 U.S. History',
    });
    fireEvent.click(classButton);
    await waitFor(() =>
      expect(deps.listStudents).toHaveBeenCalledWith({ __fake: true }, 'teacher-1', 'class-a'),
    );
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('creating a class calls createClass with the form values', async () => {
    const deps = makeDeps();
    render(<RosterPage deps={deps} />);
    fireEvent.change(await screen.findByLabelText('Class name'), {
      target: { value: 'Period 1 Civics' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'New class' }));
    await waitFor(() =>
      expect(deps.createClass).toHaveBeenCalledWith(
        { __fake: true },
        'teacher-1',
        expect.objectContaining({ name: 'Period 1 Civics' }),
      ),
    );
  });
});
