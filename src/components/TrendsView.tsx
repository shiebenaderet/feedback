import type { TrendsSummary } from '../feedback/aggregateTrends';
import { GRADING_PERIODS } from '../feedback/taxonomy';
import { tokens, panelStyle } from '../ui/theme';

export interface TrendsViewProps {
  summary: TrendsSummary;
}

/** Presentational rendering of a TrendsSummary. No data loading. */
export function TrendsView({ summary }: TrendsViewProps) {
  if (summary.total === 0) {
    return <p style={{ color: tokens.color.muted }}>No feedback yet.</p>;
  }

  // Grading periods rendered in canonical taxonomy order, present ones only.
  const periods = GRADING_PERIODS.filter((p) => summary.byGradingPeriod[p] != null);

  return (
    <div style={{ display: 'grid', gap: tokens.space(2) }}>
      <p style={{ color: tokens.color.subtle, margin: 0 }}>
        {summary.total} pieces of feedback
      </p>

      <section role="region" aria-label="Top growth areas" style={panelStyle()}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Top growth areas</h2>
        <ul
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: tokens.space(1) }}
        >
          {summary.topGrowthAreas.map((g) => (
            <li key={g.area} style={{ color: tokens.color.text }}>
              {g.area} — {g.count}
            </li>
          ))}
        </ul>
      </section>

      <section role="region" aria-label="Strength / growth balance" style={panelStyle()}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Strength / growth balance</h2>
        <div style={{ display: 'flex', gap: tokens.space(3) }}>
          <span>
            Strength:{' '}
            <strong data-testid="balance-strength">
              {summary.strengthGrowthBalance.strength}
            </strong>
          </span>
          <span>
            Growth:{' '}
            <strong data-testid="balance-growth">{summary.strengthGrowthBalance.growth}</strong>
          </span>
        </div>
      </section>

      <section role="region" aria-label="By grading period" style={panelStyle()}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>By grading period</h2>
        <ul
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: tokens.space(2) }}
        >
          {periods.map((p) => (
            <li key={p} style={{ color: tokens.color.text }}>
              {p}: <strong>{summary.byGradingPeriod[p]}</strong>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
