// src/send/gmailSender.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGmailSender } from './gmailSender';

// SendableMessage shape (from batchSendMachine): { id, email, finalText }
const message = { id: 'm1', email: 'student@school.edu', finalText: 'You did well.' };

describe('createGmailSender', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs a base64url raw message to users.messages.send with the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'gmail-123' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const send = createGmailSender({
      accessToken: 'tok-abc',
      from: 'teacher@school.edu',
      subject: 'Great year!',
    });
    await send(message);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    );
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-abc');
    expect(init.headers['Content-Type']).toBe('application/json');
    const sentBody = JSON.parse(init.body);
    expect(typeof sentBody.raw).toBe('string');
    // base64url: no +, /, or = characters
    expect(sentBody.raw).not.toMatch(/[+/=]/);
  });

  it('throws with the API error message on a non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid Credentials' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const send = createGmailSender({
      accessToken: 'expired',
      from: 'teacher@school.edu',
      subject: 'Great year!',
    });

    await expect(send(message)).rejects.toThrow('Invalid Credentials');
  });
});
