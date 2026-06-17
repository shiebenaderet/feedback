import { useState, type FormEvent } from 'react';
import { tokens, panelStyle, tealButtonStyle } from '../ui/theme';

export interface NewPeriodInput {
  label: string;
  order: number;
}

export interface NewCourseInput {
  name: string;
  periods: NewPeriodInput[];
}

export interface AddCourseCardProps {
  onCreate: (course: NewCourseInput) => void;
}

const STANDARD_PERIODS = [1, 2, 3, 4, 5, 6] as const;

/**
 * "Add a course" card: a course-name input, checkboxes for the standard
 * periods 1–6, and a "+ Add custom period" field for anything else (Advisory,
 * Homeroom…). On submit it emits {name, periods} where standard periods keep
 * their number as `order` and custom periods are appended with order 7, 8, …
 * Standard periods always sort before custom ones. The component owns no data
 * access — SetupPage wires `onCreate` to createCourse + createPeriod.
 */
export function AddCourseCard({ onCreate }: AddCourseCardProps) {
  const [name, setName] = useState('');
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [customDraft, setCustomDraft] = useState('');
  const [customPeriods, setCustomPeriods] = useState<string[]>([]);
  const [periodError, setPeriodError] = useState(false);

  function toggle(n: number) {
    setChecked((prev) => ({ ...prev, [n]: !prev[n] }));
  }

  function addCustom() {
    const label = customDraft.trim();
    if (label === '') return;
    setCustomPeriods((prev) => [...prev, label]);
    setCustomDraft('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() === '') return;
    const standard: NewPeriodInput[] = STANDARD_PERIODS.filter((n) => checked[n]).map((n) => ({
      label: `Period ${n}`,
      order: n,
    }));
    // Custom periods are ordered after the highest standard slot (6) → 7, 8, …
    const custom: NewPeriodInput[] = customPeriods.map((label, i) => ({
      label,
      order: STANDARD_PERIODS.length + 1 + i,
    }));
    const periods = [...standard, ...custom];
    // A course with zero periods is a dead end on Home — require at least one.
    if (periods.length === 0) {
      setPeriodError(true);
      return;
    }
    setPeriodError(false);
    onCreate({ name: name.trim(), periods });
    setName('');
    setChecked({});
    setCustomPeriods([]);
    setCustomDraft('');
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...panelStyle(), maxWidth: 520, display: 'grid', gap: tokens.space(2) }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Add a course</h2>

      <label htmlFor="course-name" style={{ display: 'grid', gap: 4 }}>
        Course name
        <input id="course-name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: tokens.space(1.5) }}>
        <legend style={{ color: tokens.color.muted, fontSize: 14 }}>Periods</legend>
        {STANDARD_PERIODS.map((n) => (
          <label key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={!!checked[n]} onChange={() => toggle(n)} />
            Period {n}
          </label>
        ))}
      </fieldset>

      <div style={{ display: 'flex', gap: tokens.space(1), alignItems: 'end' }}>
        <label htmlFor="custom-period" style={{ display: 'grid', gap: 4, flex: 1 }}>
          Add custom period
          <input
            id="custom-period"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
          />
        </label>
        <button type="button" onClick={addCustom} style={{ ...tealButtonStyle(), padding: '8px 12px' }}>
          + Add custom period
        </button>
      </div>

      {customPeriods.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: tokens.space(2), color: tokens.color.subtle }}>
          {customPeriods.map((label, i) => (
            <li key={`${label}-${i}`}>{label}</li>
          ))}
        </ul>
      )}

      {periodError && (
        <p role="alert" style={{ margin: 0, color: tokens.color.danger, fontSize: 14 }}>
          Pick at least one period for this course.
        </p>
      )}

      <button type="submit" style={tealButtonStyle()}>
        Add course
      </button>
    </form>
  );
}
