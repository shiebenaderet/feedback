// src/send/rfc822.test.ts
import { describe, it, expect } from 'vitest';
import { buildRfc822, toBase64Url } from './rfc822';

describe('toBase64Url', () => {
  it('encodes to URL-safe base64 with no padding', () => {
    // "<<>>" base64 is "PDw+Pg==" -> url-safe, unpadded: "PDw-Pg"
    expect(toBase64Url('<<>>')).toBe('PDw-Pg');
  });

  it('handles UTF-8 characters', () => {
    const encoded = toBase64Url('café');
    // decode back through the URL-safe alphabet to confirm round-trip
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(new TextDecoder().decode(bytes)).toBe('café');
  });
});

describe('buildRfc822', () => {
  it('builds headers and body separated by a blank line', () => {
    const raw = buildRfc822({
      to: 'student@school.edu',
      from: 'teacher@school.edu',
      subject: 'Great year!',
      body: 'You did well.\nKeep it up.',
    });
    expect(raw).toContain('To: student@school.edu');
    expect(raw).toContain('From: teacher@school.edu');
    expect(raw).toContain('Subject: Great year!');
    expect(raw).toContain('Content-Type: text/plain; charset="UTF-8"');
    // headers, blank line, then body
    const [headers, body] = raw.split('\r\n\r\n');
    expect(headers).toContain('Subject:');
    expect(body).toBe('You did well.\nKeep it up.');
  });

  it('encodes non-ASCII subjects as RFC 2047', () => {
    const raw = buildRfc822({
      to: 'a@b.com',
      from: 'c@d.com',
      subject: 'Félicitations',
      body: 'x',
    });
    expect(raw).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
  });
});
