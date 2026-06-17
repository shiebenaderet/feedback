// src/roster/downloadRosterTemplate.test.ts
import { describe, it, expect, vi } from 'vitest';
import { downloadRosterTemplate } from './downloadRosterTemplate';
import { buildRosterTemplateCsv } from './rosterTemplate';

describe('downloadRosterTemplate', () => {
  it('creates an object URL from a CSV blob and clicks a named anchor', () => {
    const click = vi.fn();
    const anchor = { href: '', download: '', click } as unknown as HTMLAnchorElement;
    const createElement = vi.fn((_tag: string) => anchor);
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:fake-url');
    const revokeObjectURL = vi.fn((_url: string) => undefined);

    downloadRosterTemplate({
      createElement: createElement as unknown as Document['createElement'],
      createObjectURL,
      revokeObjectURL,
    });

    expect(createElement).toHaveBeenCalledWith('a');
    // The blob URL was generated from the template's contents.
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('text/csv');
    expect(anchor.href).toBe('blob:fake-url');
    expect(anchor.download).toBe('roster-template.csv');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('builds a CSV blob whose size matches the template', () => {
    // jsdom's Blob lacks .text(), so we verify type + byte size instead of reading.
    let captured: Blob | undefined;
    const anchor = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
    downloadRosterTemplate({
      createElement: (() => anchor) as unknown as Document['createElement'],
      createObjectURL: ((b: Blob) => {
        captured = b;
        return 'blob:x';
      }) as unknown as typeof URL.createObjectURL,
      revokeObjectURL: vi.fn(),
    });
    expect(captured).toBeInstanceOf(Blob);
    expect(captured!.type).toBe('text/csv');
    expect(captured!.size).toBe(new Blob([buildRosterTemplateCsv()]).size);
  });
});
