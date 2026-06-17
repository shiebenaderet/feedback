// src/roster/downloadRosterTemplate.ts
import { buildRosterTemplateCsv } from './rosterTemplate';

/** Injectable DOM/URL primitives — default to the real browser globals, overridable in tests. */
export interface DownloadDeps {
  createElement: Document['createElement'];
  createObjectURL: typeof URL.createObjectURL;
  revokeObjectURL: typeof URL.revokeObjectURL;
}

const defaultDeps: DownloadDeps = {
  createElement: (tag: string) => document.createElement(tag),
  createObjectURL: (obj: Blob | MediaSource) => URL.createObjectURL(obj),
  revokeObjectURL: (url: string) => URL.revokeObjectURL(url),
};

/**
 * Trigger a client-side download of the roster CSV template as `roster-template.csv`.
 * Builds a text/csv Blob from buildRosterTemplateCsv(), wires it to a transient anchor,
 * clicks it, then revokes the object URL. DOM/URL access is injected for testability.
 */
export function downloadRosterTemplate(deps: Partial<DownloadDeps> = {}): void {
  const { createElement, createObjectURL, revokeObjectURL } = { ...defaultDeps, ...deps };
  const blob = new Blob([buildRosterTemplateCsv()], { type: 'text/csv' });
  const url = createObjectURL(blob);
  const anchor = createElement('a') as HTMLAnchorElement;
  anchor.href = url;
  anchor.download = 'roster-template.csv';
  anchor.click();
  revokeObjectURL(url);
}
