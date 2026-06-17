import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const signOutTeacher = vi.fn(() => Promise.resolve());
vi.mock('../auth/authService', () => ({ signOutTeacher: () => signOutTeacher() }));

import { NavBar } from './NavBar';

describe('NavBar', () => {
  it('renders the logo and Home link pointing at the right route', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );
    expect(screen.getByText('Feedback')).toBeInTheDocument();
    // Two "home" links: the Feedback wordmark and the Home nav item both go to /home.
    screen.getAllByRole('link', { name: /home|feedback/i }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/home');
    });
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
