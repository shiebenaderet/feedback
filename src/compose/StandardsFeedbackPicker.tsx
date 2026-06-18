import { useMemo, useState } from 'react';
import {
  LEVELED_COMMENTS,
  leveledComment,
  type Proficiency,
} from '../standards/leveledComments';
import { labelForCode } from '../standards/standards';
import { firstName } from './firstName';
import { tokens } from '../ui/theme';

export interface StandardsFeedbackPickerProps {
  /** The student whose first name fills the {name} token. */
  studentName: string;
  /** Append the assembled leveled comment into the message (dirties it). */
  onInsert: (text: string) => void;
  /**
   * When provided, RESTRICT the standard dropdown to these codes (e.g. an
   * assignment's linked standards). Defaults to every standard present in the
   * leveled-comment bank. Codes with no leveled comments are filtered out.
   */
  standardCodes?: string[];
}

/** Proficiency levels, ordered 4 → 1, with their district scale words. */
const LEVELS: { level: Proficiency; word: string }[] = [
  { level: 4, word: 'Exemplary' },
  { level: 3, word: 'Proficient' },
  { level: 2, word: 'Progressing' },
  { level: 1, word: 'Beginning' },
];

/**
 * Standards-based leveled feedback picker: choose a standard + a proficiency
 * level (4/3/2/1) and insert the matching pre-written comment with the
 * student's first name filled in, optionally with its next-step clause.
 */
export function StandardsFeedbackPicker({
  studentName,
  onInsert,
  standardCodes,
}: StandardsFeedbackPickerProps) {
  // Distinct standard codes present in the bank, sorted for a stable list.
  // When `standardCodes` is supplied, restrict to those (intersected with the
  // codes that actually have leveled comments, so options always resolve).
  const codes = useMemo(() => {
    const available = new Set(LEVELED_COMMENTS.map((c) => c.standardCode));
    if (standardCodes && standardCodes.length > 0) {
      return standardCodes.filter((c) => available.has(c));
    }
    return Array.from(available).sort();
  }, [standardCodes]);

  const [selectedCode, setSelectedCode] = useState<string>(codes[0] ?? '');
  const [includeNextStep, setIncludeNextStep] = useState(true);

  const name = firstName(studentName);

  const insertLevel = (level: Proficiency) => {
    if (!selectedCode) return;
    const comment = leveledComment(selectedCode, level);
    if (!comment) return;
    // `text` starts with the {name} token; fill it with the first name.
    let text = comment.text.replace('{name}', name);
    if (includeNextStep && comment.nextStep) {
      text += ` ${comment.nextStep}`;
    }
    onInsert(text);
  };

  return (
    <div className="standards-feedback" role="group" aria-label="Standards feedback">
      <div
        className="label"
        style={{ color: tokens.color.muted, fontSize: 13, marginBottom: tokens.space(1) }}
      >
        Standards feedback
      </div>
      <select
        aria-label="Standard"
        data-testid="standards-feedback-select"
        value={selectedCode}
        onChange={(e) => setSelectedCode(e.target.value)}
        style={{
          display: 'block',
          width: '100%',
          boxSizing: 'border-box',
          fontFamily: tokens.font,
          fontSize: 13,
          color: tokens.color.text,
          background: tokens.color.panelAlt,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.md,
          padding: tokens.space(1),
          marginBottom: tokens.space(1.5),
        }}
      >
        {codes.map((code) => (
          <option key={code} value={code}>
            {labelForCode(code)}
          </option>
        ))}
      </select>
      <div
        className="standards-feedback-levels"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: tokens.space(1.5) }}
      >
        {LEVELS.map(({ level, word }) => (
          <button
            key={level}
            type="button"
            aria-label={`${level} ${word}`}
            onClick={() => insertLevel(level)}
            disabled={!selectedCode}
            style={{
              cursor: selectedCode ? 'pointer' : 'default',
              background: tokens.color.panelAlt,
              color: tokens.color.text,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.md,
              padding: `${tokens.space(0.75)}px ${tokens.space(1.25)}px`,
              fontFamily: tokens.font,
              fontSize: 13,
              opacity: selectedCode ? 1 : 0.6,
            }}
          >
            <strong>{level}</strong> {word}
          </button>
        ))}
      </div>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: tokens.color.muted,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={includeNextStep}
          onChange={(e) => setIncludeNextStep(e.target.checked)}
        />
        Include next step
      </label>
    </div>
  );
}
