// src/roster/UploadRosterPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UploadRosterPanel } from './UploadRosterPanel';

describe('UploadRosterPanel', () => {
  it('clicking "Download template" invokes the injected download fn', () => {
    const onDownloadTemplate = vi.fn();
    render(<UploadRosterPanel onParsed={vi.fn()} onDownloadTemplate={onDownloadTemplate} />);
    fireEvent.click(screen.getByRole('button', { name: /download template/i }));
    expect(onDownloadTemplate).toHaveBeenCalledTimes(1);
  });

  it('reading a chosen CSV file parses it and calls onParsed', async () => {
    const onParsed = vi.fn();
    render(<UploadRosterPanel onParsed={onParsed} onDownloadTemplate={vi.fn()} />);
    const input = screen.getByLabelText(/upload a csv/i) as HTMLInputElement;
    const file = new File(['name,email\nAda Lovelace,ada@x.edu\n'], 'roster.csv', {
      type: 'text/csv',
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onParsed).toHaveBeenCalledTimes(1));
    const result = onParsed.mock.calls[0][0];
    expect(result.students).toEqual([
      { name: 'Ada Lovelace', email: 'ada@x.edu', period: '', sourceRow: 2 },
    ]);
  });
});
