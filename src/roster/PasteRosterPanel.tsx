// src/roster/PasteRosterPanel.tsx
import { useState } from 'react';
import { parsePastedRoster } from './parsePastedRoster';
import type { ParseResult } from './types';
import { tokens, tealButtonStyle } from '../ui/theme';

interface PasteRosterPanelProps {
  /** Called with the ParseResult so the page can render the shared ImportPreview. */
  onParsed: (result: ParseResult) => void;
}

/**
 * The "Paste a list" entry method: a textarea + "Parse & add". Runs parsePastedRoster
 * over the pasted rows and hands the ParseResult up so the page shows the same
 * ImportPreview used for CSV upload. No-ops on empty input.
 */
export function PasteRosterPanel({ onParsed }: PasteRosterPanelProps) {
  const [text, setText] = useState('');

  function handleParse() {
    if (!text.trim()) return;
    onParsed(parsePastedRoster(text));
  }

  return (
    <div className="paste-roster-panel">
      <label
        htmlFor="paste-roster"
        style={{ display: 'block', color: tokens.color.subtle, marginBottom: tokens.space(1) }}
      >
        Paste a list (one student per line: Name, email)
      </label>
      <textarea
        id="paste-roster"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        style={{ width: '100%', fontFamily: tokens.mono }}
        placeholder={'Ada Lovelace, ada@school.edu\nAlan Turing, alan@school.edu'}
      />
      <button
        type="button"
        style={{ ...tealButtonStyle(), marginTop: tokens.space(1) }}
        onClick={handleParse}
      >
        Parse & add
      </button>
    </div>
  );
}
