// src/send/chooseSendMode.test.ts
import { describe, it, expect } from 'vitest';
import { chooseSendMode } from './chooseSendMode';

describe('chooseSendMode', () => {
  it('defaults to Mode A when the Gmail-send scope is available', () => {
    expect(chooseSendMode({ gmailScopeGranted: true })).toBe('A');
  });

  it('auto-defaults to Mode B when OAuth/scope is unavailable', () => {
    expect(chooseSendMode({ gmailScopeGranted: false })).toBe('B');
  });

  it('honors an explicit per-batch override to Mode B even when scope exists', () => {
    expect(chooseSendMode({ gmailScopeGranted: true, override: 'B' })).toBe('B');
  });

  it('cannot override to Mode A when the scope is missing', () => {
    expect(chooseSendMode({ gmailScopeGranted: false, override: 'A' })).toBe('B');
  });
});
