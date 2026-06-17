import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { getBatch, setBatchStatus, updateBatch } from '../firebase/batches';
import { listMessages } from '../firebase/messages';
import { listStudents } from '../data/students';
import { listBankEntries } from '../bank/bankRepo';
import { writeFeedbackHistory } from '../data/writeFeedbackHistory';
import { makeHistoryWriter } from '../feedback/makeHistoryWriter';
import { getGmailAccessToken } from '../auth/gmailToken';
import { chooseSendMode } from '../send/chooseSendMode';
import { createGmailSender } from '../send/gmailSender';
import { makeRunSend } from '../send/makeRunSend';
import { ReviewScreenContainer } from '../review/ReviewScreenContainer';
import {
  GradingPeriodChooser,
  type GradingPeriodValue,
} from '../components/GradingPeriodChooser';
import { GRADING_PERIODS, type GradingPeriod } from '../feedback/taxonomy';
import type { Batch, BankEntry, MessageDraft } from '../types';
import type { GmailSender } from '../send/batchSendMachine';
import { tokens } from '../ui/theme';

const SUBJECT = 'Feedback on your work';

export interface ReviewSendPageDeps {
  uid: string;
  email: string;
  getBatch: typeof getBatch;
  listMessages: typeof listMessages;
  listStudents: typeof listStudents;
  listBankEntries: (db: unknown, uid: string) => Promise<BankEntry[]>;
  setBatchStatus: typeof setBatchStatus;
  updateBatch: typeof updateBatch;
  writeFeedbackHistory: typeof writeFeedbackHistory;
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
    listBankEntries:
      deps?.listBankEntries ?? (listBankEntries as ReviewSendPageDeps['listBankEntries']),
    setBatchStatus: deps?.setBatchStatus ?? setBatchStatus,
    updateBatch: deps?.updateBatch ?? updateBatch,
    writeFeedbackHistory: deps?.writeFeedbackHistory ?? writeFeedbackHistory,
  };

  const token = getGmailAccessToken();
  const mode = chooseSendMode({ gmailScopeGranted: !!token });

  const [batch, setBatch] = useState<Batch | null>(null);
  const [messages, setMessages] = useState<MessageDraft[]>([]);
  const [emailById, setEmailById] = useState<Record<string, string>>({});
  const [bankEntries, setBankEntries] = useState<BankEntry[]>([]);
  const [gp, setGp] = useState<GradingPeriodValue>({
    gradingPeriod: GRADING_PERIODS[0],
    label: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !batchId) return;
    let alive = true;
    (async () => {
      try {
        const b = await api.getBatch(db, uid, batchId);
        if (!b) throw new Error('Batch not found');
        const [msgs, roster, entries] = await Promise.all([
          api.listMessages(db, uid, batchId),
          api.listStudents(db, uid, b.yearId, b.courseId, b.periodId),
          api.listBankEntries(db, uid),
        ]);
        if (!alive) return;
        setBatch(b);
        setMessages(msgs);
        setEmailById(Object.fromEntries(roster.map((s) => [s.id, s.email])));
        setBankEntries(entries as BankEntry[]);
        setGp({
          gradingPeriod: (b.gradingPeriod ?? GRADING_PERIODS[0]) as GradingPeriod,
          label: b.label ?? '',
        });
      } catch {
        if (alive) setError('Could not load this batch.');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, batchId]);

  const onGpChange = useCallback(
    (value: GradingPeriodValue) => {
      setGp(value);
      void api.updateBatch(db, uid, batchId, {
        gradingPeriod: value.gradingPeriod,
        label: value.label,
      } as Partial<Batch>);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, batchId],
  );

  // Mode A sender: injected in tests, else the real Gmail sender from the token.
  const sendOne: GmailSender = useMemo(() => {
    if (deps?.sendOne) return deps.sendOne;
    return createGmailSender({ accessToken: token ?? '', from: email, subject: SUBJECT });
  }, [deps?.sendOne, token, email]);

  const runSend = useMemo(
    () => makeRunSend(sendOne, (id) => emailById[id] ?? ''),
    [sendOne, emailById],
  );

  const onSent = useMemo(() => {
    if (!batch) return undefined;
    return makeHistoryWriter({
      db,
      uid,
      tree: { yearId: batch.yearId, courseId: batch.courseId, periodId: batch.periodId },
      gradingPeriod: gp.gradingPeriod,
      label: gp.label,
      bankEntries,
      writeFeedbackHistory: api.writeFeedbackHistory,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch, uid, gp.gradingPeriod, gp.label, bankEntries]);

  if (error)
    return (
      <main style={{ maxWidth: 1180, margin: ' 0 auto', padding: tokens.space(4) }}>
        <p role="alert">{error}</p>
      </main>
    );
  if (!batch)
    return (
      <main>
        <p>Loading…</p>
      </main>
    );

  return (
    <>
      <NavBar />
      <main>
        <h1>Review & send · {batch.sharedHeader}</h1>

        <GradingPeriodChooser
          gradingPeriod={gp.gradingPeriod}
          label={gp.label}
          onChange={onGpChange}
        />

        <ReviewScreenContainer
          batch={batch}
          messages={messages}
          mode={mode}
          runSend={runSend}
          setBatchStatus={(status) =>
            api.setBatchStatus(db, uid, batchId, status as 'sending' | 'sent')
          }
          onSent={onSent}
        />

        <p style={{ marginTop: 24 }}>
          <Link to="/home">← Back to Home</Link>
        </p>
      </main>
    </>
  );
}
