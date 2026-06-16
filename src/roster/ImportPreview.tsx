// src/roster/ImportPreview.tsx
import type { ParseResult } from './types';

interface ImportPreviewProps {
  result: ParseResult;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Pre-commit review of a parsed roster: found/skipped counts, the column mapping,
 * and every skipped row with its reason (never silently dropped). Confirm writes;
 * cancel discards. Confirm is disabled when there is nothing importable.
 */
export function ImportPreview({ result, onConfirm, onCancel }: ImportPreviewProps) {
  const { students, skipped, duplicates, columnMapping } = result;
  const canImport = students.length > 0;

  return (
    <div className="import-preview">
      <p>
        Found {students.length} students, {skipped.length} skipped
        {duplicates.length > 0 ? `, ${duplicates.length} duplicate email(s)` : ''}.
      </p>

      <h3>Column mapping</h3>
      <ul>
        <li>name → {columnMapping.name ?? '(not found)'}</li>
        <li>email → {columnMapping.email ?? '(not found)'}</li>
        <li>period → {columnMapping.period ?? '(not found)'}</li>
      </ul>

      {skipped.length > 0 && (
        <>
          <h3>Skipped rows</h3>
          <ul>
            {skipped.map((s) => (
              <li key={s.sourceRow}>
                Row {s.sourceRow}: {s.reason}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="import-preview-actions">
        <button type="button" onClick={onConfirm} disabled={!canImport}>
          Import {students.length} students
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
