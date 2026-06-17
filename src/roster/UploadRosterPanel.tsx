// src/roster/UploadRosterPanel.tsx
import { type ChangeEvent } from 'react';
import { parseRoster } from './parseRoster';
import { downloadRosterTemplate } from './downloadRosterTemplate';
import type { ParseResult } from './types';
import { tokens, tealButtonStyle } from '../ui/theme';

interface UploadRosterPanelProps {
  /** Called with the ParseResult so the page can render the shared ImportPreview. */
  onParsed: (result: ParseResult) => void;
  /** Injectable for testing; defaults to the real Blob download. */
  onDownloadTemplate?: () => void;
}

/**
 * The "Upload CSV" entry method: a "Download template" button (Blob download of the
 * name,email template) plus a file input that reads the chosen file and runs the existing
 * messy-data-tolerant parseRoster, handing the ParseResult up so the page shows ImportPreview.
 */
export function UploadRosterPanel({
  onParsed,
  onDownloadTemplate = downloadRosterTemplate,
}: UploadRosterPanelProps) {
  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onParsed(parseRoster(String(reader.result ?? '')));
    reader.readAsText(file);
  }

  return (
    <div className="upload-roster-panel">
      <button
        type="button"
        style={{ ...tealButtonStyle(), marginBottom: tokens.space(1) }}
        onClick={onDownloadTemplate}
      >
        Download template
      </button>
      <div>
        <label htmlFor="roster-csv" style={{ display: 'block', color: tokens.color.subtle }}>
          Upload a CSV (name, email)
        </label>
        <input id="roster-csv" type="file" accept=".csv,text/csv" onChange={handleFile} />
      </div>
    </div>
  );
}
