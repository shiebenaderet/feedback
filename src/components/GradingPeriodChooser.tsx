import { GRADING_PERIODS, type GradingPeriod } from '../feedback/taxonomy';
import { tokens } from '../ui/theme';

export interface GradingPeriodValue {
  gradingPeriod: GradingPeriod;
  label: string;
}

export interface GradingPeriodChooserProps {
  gradingPeriod: GradingPeriod;
  label: string;
  onChange: (value: GradingPeriodValue) => void;
}

/**
 * Pre-send chooser: which grading period this round belongs to (fixed
 * GRADING_PERIODS from the taxonomy) plus an optional free-text label
 * ('Unit 3 reflections'). The chosen value is stamped on the batch and on
 * every feedbackHistory entry written in this round.
 */
export function GradingPeriodChooser({
  gradingPeriod,
  label,
  onChange,
}: GradingPeriodChooserProps) {
  return (
    <fieldset
      style={{
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
        padding: tokens.space(2),
        display: 'flex',
        gap: tokens.space(2),
        alignItems: 'flex-end',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label htmlFor="grading-period">Grading period</label>
        <select
          id="grading-period"
          value={gradingPeriod}
          onChange={(e) =>
            onChange({ gradingPeriod: e.target.value as GradingPeriod, label })
          }
        >
          {GRADING_PERIODS.map((gp) => (
            <option key={gp} value={gp}>
              {gp}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <label htmlFor="grading-label">Label (optional)</label>
        <input
          id="grading-label"
          type="text"
          placeholder="e.g. Unit 3 reflections"
          value={label}
          onChange={(e) => onChange({ gradingPeriod, label: e.target.value })}
        />
      </div>
    </fieldset>
  );
}
