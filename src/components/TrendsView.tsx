import type { TrendsSummary } from '../feedback/aggregateTrends';
import { GRADING_PERIODS } from '../feedback/taxonomy';
import { tokens, cardStyle, periodChipStyle, chipStyle } from '../ui/theme';

export interface TrendsViewProps {
  summary: TrendsSummary;
  /** Optional unit filter. When provided, a chip row is rendered above trends. */
  units?: string[];
  /** The currently selected unit, or null for "All units". */
  selectedUnit?: string | null;
  /** Called with the chosen unit (null === All units). */
  onSelectUnit?: (unit: string | null) => void;
}

/** Filter chips for unit slicing. "All units" first, then each distinct unit. */
function UnitFilter({
  units,
  selectedUnit,
  onSelectUnit,
}: {
  units: string[];
  selectedUnit: string | null;
  onSelectUnit: (unit: string | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter by unit"
      style={{ display: 'flex', gap: tokens.space(1), flexWrap: 'wrap', alignItems: 'center' }}
    >
      <button
        type="button"
        style={chipStyle(selectedUnit === null)}
        aria-pressed={selectedUnit === null}
        onClick={() => onSelectUnit(null)}
      >
        All units
      </button>
      {units.map((u) => (
        <button
          key={u}
          type="button"
          style={chipStyle(selectedUnit === u)}
          aria-pressed={selectedUnit === u}
          onClick={() => onSelectUnit(u)}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

/** Presentational rendering of a TrendsSummary. No data loading. */
export function TrendsView({ summary, units, selectedUnit, onSelectUnit }: TrendsViewProps) {
  const showUnitFilter = units != null && units.length > 0 && onSelectUnit != null;
  const filter = showUnitFilter ? (
    <UnitFilter
      units={units}
      selectedUnit={selectedUnit ?? null}
      onSelectUnit={onSelectUnit}
    />
  ) : null;

  if (summary.total === 0) {
    return (
      <div style={{ display: 'grid', gap: tokens.space(2) }}>
        {filter}
        <p style={{ color: tokens.color.muted }}>No feedback yet.</p>
      </div>
    );
  }

  // Grading periods rendered in canonical taxonomy order, present ones only.
  const periods = GRADING_PERIODS.filter((p) => summary.byGradingPeriod[p] != null);

  return (
    <div style={{ display: 'grid', gap: tokens.space(2) }}>
      {filter}
      <p style={{ color: tokens.color.subtle, margin: 0 }}>
        {summary.total} pieces of feedback
      </p>

      <section role="region" aria-label="Top growth areas" style={cardStyle()}>
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

      <section role="region" aria-label="Strength / growth balance" style={cardStyle()}>
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

      <section role="region" aria-label="By grading period" style={cardStyle()}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>By grading period</h2>
        <ul
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: tokens.space(2) }}
        >
          {periods.map((p) => (
            <li
              key={p}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: tokens.color.text }}
            >
              <span style={periodChipStyle(true)}>{p}</span>
              <strong>{summary.byGradingPeriod[p]}</strong>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
