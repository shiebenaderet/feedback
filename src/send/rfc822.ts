// src/send/rfc822.ts

export interface EmailFields {
  to: string;
  from: string;
  subject: string;
  body: string;
}

// Browser-safe UTF-8 base64url (no Node Buffer dependency).
export function toBase64Url(input: string): string {
  const utf8 = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of utf8) binary += String.fromCharCode(byte);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeSubject(subject: string): string {
  // Plain ASCII passes through; anything else uses RFC 2047 base64 word.
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
}

export function buildRfc822(fields: EmailFields): string {
  const headers = [
    `To: ${fields.to}`,
    `From: ${fields.from}`,
    `Subject: ${encodeSubject(fields.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
  ].join('\r\n');
  return `${headers}\r\n\r\n${fields.body}`;
}
