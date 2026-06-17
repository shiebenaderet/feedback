import { GRADING_PERIODS, type GradingPeriod } from '../feedback/taxonomy';
import { tokens, chipStyle } from '../ui/theme';

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
 * Pre-send chooser: which grading period this round belongs to (the fixed
 * GRADING_PERIODS from the taxonomy, shown as selectable chips) plus an optional
 * free-text label ('Unit 3 reflections'). The chosen value is stamped on the
 * batch and on every feedbackHistory entry written in this round.
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
        flexDirection: 'column',
        gap: tokens.space(1.5),
      }}
    >
      <legend style={{ color: tokens.color.muted, fontSize: 14, padding: '0 6px' }}>
        Grading period
      </legend>

      <div
        role="group"
        aria-label="Grading period"
        style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(1) }}
      >
        {GRADING_PERIODS.map((gp) => {
          const active = gp === gradingPeriod;
          return (
            <button
              key={gp}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ gradingPeriod: gp, label })}
              style={{
                ...chipStyle(active),
                cursor: 'pointer',
                color: active ? tokens.color.teal : tokens.color.subtle,
              }}
            >
              {gp}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
