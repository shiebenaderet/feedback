import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { TrendsView } from './TrendsView';
import type { TrendsSummary } from '../feedback/aggregateTrends';

const summary: TrendsSummary = {
  total: 7,
  byArea: { cer: 3, discussion: 2, research: 2 },
  bySentiment: { strength: 4, growth: 2, neutral: 1 },
  byGradingPeriod: { Q1: 4, Q2: 3 },
  byStandard: { argumentation: 3, participation: 2 },
  strengthGrowthBalance: { strength: 4, growth: 2 },
  topGrowthAreas: [
    { area: 'discussion', count: 2 },
    { area: 'research', count: 1 },
  ],
};

describe('TrendsView', () => {
  it('renders the total feedback count', () => {
    render(<TrendsView summary={summary} />);
    expect(screen.getByText(/7 pieces of feedback/i)).toBeInTheDocument();
  });

  it('lists top growth areas in order', () => {
    render(<TrendsView summary={summary} />);
    const region = screen.getByRole('region', { name: /top growth areas/i });
    const items = within(region).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('discussion');
    expect(items[0]).toHaveTextContent('2');
    expect(items[1]).toHaveTextContent('research');
  });

  it('shows the strength/growth balance counts', () => {
    render(<TrendsView summary={summary} />);
    const region = screen.getByRole('region', { name: /strength.*growth balance/i });
    // The region shows both strength and growth counts (heading + labels both
    // contain "strength", so assert the unambiguous testids instead).
    expect(within(region).getByTestId('balance-strength')).toHaveTextContent('4');
    expect(within(region).getByTestId('balance-growth')).toHaveTextContent('2');
  });

  it('compares grading periods in taxonomy order', () => {
    render(<TrendsView summary={summary} />);
    const region = screen.getByRole('region', { name: /by grading period/i });
    const cells = within(region).getAllByRole('listitem');
    expect(cells[0]).toHaveTextContent('Q1');
    expect(cells[0]).toHaveTextContent('4');
    expect(cells[1]).toHaveTextContent('Q2');
  });

  it('renders standard-filter chips (bare codes, full label as accessible name) and reports selection', () => {
    const onSelectStandard = vi.fn();
    render(
      <TrendsView
        summary={summary}
        standards={['SSS1.6-8.2', 'SSS4.6-8.1']}
        selectedStandard={null}
        onSelectStandard={onSelectStandard}
      />,
    );
    const group = screen.getByRole('group', { name: /filter by standard/i });
    expect(within(group).getByRole('button', { name: /all standards/i })).toBeInTheDocument();
    const chip = within(group).getByRole('button', { name: /SSS4\.6-8\.1/ });
    // Bare code is the visible label; full description is the accessible name.
    expect(chip).toHaveTextContent('SSS4.6-8.1');
    expect(chip.getAttribute('aria-label')).toMatch(/SSS4\.6-8\.1 —/);
    fireEvent.click(chip);
    expect(onSelectStandard).toHaveBeenCalledWith('SSS4.6-8.1');
  });

  it('renders an empty state when there is no feedback', () => {
    const empty: TrendsSummary = {
      total: 0, byArea: {}, bySentiment: {}, byGradingPeriod: {}, byStandard: {},
      strengthGrowthBalance: { strength: 0, growth: 0 }, topGrowthAreas: [],
    };
    render(<TrendsView summary={empty} />);
    expect(screen.getByText(/no feedback yet/i)).toBeInTheDocument();
  });
});
