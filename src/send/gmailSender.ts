// src/send/gmailSender.ts
import { buildRfc822, toBase64Url } from './rfc822';

// SendableMessage shape from batchSendMachine: { id, email, finalText }
interface SendableMessage {
  id: string;
  email: string;
  finalText: string;
}

export interface GmailSenderConfig {
  accessToken: string;
  from: string;
  subject: string;
}

const SEND_URL =
  'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

// Returns a GmailSender: (message) => Promise<void>, compatible with runSend.
export function createGmailSender(config: GmailSenderConfig) {
  return async function send(message: SendableMessage): Promise<void> {
    const raw = toBase64Url(
      buildRfc822({
        to: message.email,
        from: config.from,
        subject: config.subject,
        body: message.finalText,
      }),
    );

    const res = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      let detail = `Gmail send failed (HTTP ${res.status})`;
      try {
        const data = await res.json();
        if (data?.error?.message) detail = data.error.message;
      } catch {
        // keep the HTTP-status fallback
      }
      throw new Error(detail);
    }
  };
}
