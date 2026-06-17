import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumbs } from './Breadcrumbs';

describe('Breadcrumbs', () => {
  it('renders Year › Course › Period with links for the crumbs that have a `to`', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs
          items={[
            { label: '2025–26', to: '/home' },
            { label: 'Biology', to: '/setup' },
            { label: 'Period 3' },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: '2025–26' })).toHaveAttribute('href', '/home');
    expect(screen.getByRole('link', { name: 'Biology' })).toHaveAttribute('href', '/setup');
    // The last crumb (current location) is plain text, not a link.
    expect(screen.queryByRole('link', { name: 'Period 3' })).toBeNull();
    expect(screen.getByText('Period 3')).toBeInTheDocument();
    // Two separators between three crumbs.
    expect(screen.getAllByText('›')).toHaveLength(2);
  });

  it('renders nothing when given no items', () => {
    const { container } = render(
      <MemoryRouter>
        <Breadcrumbs items={[]} />
      </MemoryRouter>,
    );
    expect(container.querySelector('nav')).toBeNull();
  });
});
