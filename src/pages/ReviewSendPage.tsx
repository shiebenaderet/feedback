import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { getBatch, setBatchStatus } from '../firebase/batches';
import { listMessages } from '../firebase/messages';
import { listStudents } from '../data/listStudents';
import { getGmailAccessToken } from '../auth/gmailToken';
import { chooseSendMode } from '../send/chooseSendMode';
import { createGmailSender } from '../send/gmailSender';
import { makeRunSend } from '../send/makeRunSend';
import { ReviewScreenContainer } from '../review/ReviewScreenContainer';
import type { Batch, MessageDraft } from '../types';
import type { GmailSender } from '../send/batchSendMachine';
import { tokens } from '../ui/theme';

const SUBJECT = 'Feedback on your work';

export interface ReviewSendPageDeps {
  uid: string;
  email: string;
  getBatch: typeof getBatch;
  listMessages: typeof listMessages;
  listStudents: typeof listStudents;
  setBatchStatus: typeof setBatchStatus;
  /** Pre-built Gmail send fn; defaults to createGmailSender(...). Lets tests skip OAuth. */
  sendOne: GmailSender;
}

export function ReviewSendPage({ deps }: { deps?: Partial<ReviewSendPageDeps> }) {
  const { batchId = '' } = useParams();
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const email = deps?.email ?? user?.email ?? '';

  const api = {
    getBatch: deps?.getBatch ?? getBatch,
    listMessages: deps?.listMessages ?? listMessages,
    listStudents: deps?.listStudents ?? listStudents,
    setBatchStatus: deps?.setBatchStatus ?? setBatchStatus,
  };

  const token = getGmailAccessToken();
  const mode = chooseSendMode({ gmailScopeGranted: !!token });

  const [batch, setBatch] = useState<Batch | null>(null);
  const [messages, setMessages] = useState<MessageDraft[]>([]);
  const [emailById, setEmailById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !batchId) return;
    let alive = true;
    (async () => {
      try {
        const b = await api.getBatch(db, uid, batchId);
        if (!b) throw new Error('Batch not found');
        const msgs = await api.listMessages(db, uid, batchId);
        // Phase 4 threads the full year/course/period tree here; for now the
        // batch's periodId satisfies the (transitional) listStudents signature.
        const roster = await api.listStudents(db, uid, b.periodId);
        if (!alive) return;
        setBatch(b);
        setMessages(msgs);
        setEmailById(Object.fromEntries(roster.map((s) => [s.id, s.email])));
      } catch {
        if (alive) setError('Could not load this batch.');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, batchId]);

  // Mode A sender: injected in tests, else the real Gmail sender from the token.
  const sendOne: GmailSender = useMemo(() => {
    if (deps?.sendOne) return deps.sendOne;
    return createGmailSender({ accessToken: token ?? '', from: email, subject: SUBJECT });
  }, [deps?.sendOne, token, email]);

  const runSend = useMemo(
    () => makeRunSend(sendOne, (id) => emailById[id] ?? ''),
    [sendOne, emailById],
  );

  if (error) return <main style={{ maxWidth: 1180, margin: ' 0 auto', padding: tokens.space(4) }}><p role="alert">{error}</p></main>;
  if (!batch) return <main><p>Loading…</p></main>;

  return (
    <main>
      <h1>Review &amp; send · {batch.sharedHeader}</h1>
      <ReviewScreenContainer
        batch={batch}
        messages={messages}
        mode={mode}
        runSend={runSend}
        setBatchStatus={(status) => api.setBatchStatus(db, uid, batchId, status as 'sending' | 'sent')}
      />
    </main>
  );
}
