import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const signOutTeacher = vi.fn(() => Promise.resolve());
vi.mock('../auth/authService', () => ({ signOutTeacher: () => signOutTeacher() }));

import { NavBar } from './NavBar';

describe('NavBar', () => {
  it('renders the logo and Home/Bank links pointing at the right routes', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );
    expect(screen.getByText('Feedback')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/home');
    expect(screen.getByRole('link', { name: /^bank$/i })).toHaveAttribute('href', '/bank');
  });

  it('calls signOutTeacher when Sign out is clicked', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOutTeacher).toHaveBeenCalledTimes(1);
  });
});
