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
import { tokens, panelStyle } from '../ui/theme';

const DEFAULT_SUBJECT = 'Feedback on your work';

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
  const [roster, setRoster] = useState<{ id: string; name: string }[]>([]);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [unit, setUnit] = useState('');
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
        setRoster(roster.map((s) => ({ id: s.id, name: s.name })));
        setBankEntries(entries as BankEntry[]);
        setGp({
          gradingPeriod: (b.gradingPeriod ?? GRADING_PERIODS[0]) as GradingPeriod,
          label: b.label ?? '',
        });
        setUnit(b.unit ?? '');
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

  const onUnitChange = useCallback(
    (value: string) => {
      setUnit(value);
      void api.updateBatch(db, uid, batchId, { unit: value } as Partial<Batch>);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, batchId],
  );

  // Mode A sender: injected in tests, else the real Gmail sender from the token.
  const sendOne: GmailSender = useMemo(() => {
    if (deps?.sendOne) return deps.sendOne;
    return createGmailSender({ accessToken: token ?? '', from: email, subject });
  }, [deps?.sendOne, token, email, subject]);

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
      unit,
      bankEntries,
      batchId: batch.id,
      writeFeedbackHistory: api.writeFeedbackHistory,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch, uid, gp.gradingPeriod, gp.label, unit, bankEntries]);

  // Roster students with NO draft, or whose draft is empty/whitespace-only, will
  // not receive feedback — surface them so nothing is silently skipped.
  const unmessagedNames = useMemo(() => {
    const byStudent = new Map(messages.map((m) => [m.studentId, m]));
    // Quick rounds target only a subset; don't warn about students this round
    // was never meant to include.
    const targets = batch?.targetStudentIds;
    const considered =
      targets && targets.length > 0 ? roster.filter((s) => targets.includes(s.id)) : roster;
    return considered
      .filter((s) => {
        const draft = byStudent.get(s.id);
        return !draft || draft.finalText.trim().length === 0;
      })
      .map((s) => s.name);
  }, [roster, messages, batch?.targetStudentIds]);

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

  // Already-sent batches render read-only: re-opening (Back button, bookmarked
  // URL, second tab) must NOT re-send or re-write history.
  if (batch.status === 'sent') {
    return (
      <>
        <NavBar />
        <main style={{ maxWidth: 1180, margin: '0 auto', padding: tokens.space(4) }}>
          <h1>Review & send · {batch.sharedHeader}</h1>
          <p
            role="status"
            style={{
              ...panelStyle(),
              padding: tokens.space(2),
              color: tokens.color.teal,
              fontWeight: 600,
            }}
          >
            ✓ This feedback round has already been sent.
          </p>
          <ul style={{ display: 'grid', gap: tokens.space(1), padding: 0, listStyle: 'none' }}>
            {messages.map((m) => (
              <li key={m.studentId} style={{ ...panelStyle(), padding: tokens.space(2) }}>
                <strong>{m.name}</strong>
                <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', color: tokens.color.subtle }}>
                  {m.finalText}
                </p>
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 24 }}>
            <Link to="/home">← Back to Home</Link>
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: tokens.space(4) }}>
        <h1>Review & send · {batch.sharedHeader}</h1>

        <GradingPeriodChooser
          gradingPeriod={gp.gradingPeriod}
          label={gp.label}
          onChange={onGpChange}
        />

        <label style={{ display: 'block', margin: `${tokens.space(2)}px 0` }}>
          <span style={{ display: 'block', fontSize: 13, color: tokens.color.muted, marginBottom: 4 }}>
            Subject
          </span>
          <input
            type="text"
            aria-label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{
              width: '100%',
              maxWidth: 520,
              background: tokens.color.panelAlt,
              color: tokens.color.text,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.md,
              padding: '8px 12px',
              fontSize: 15,
              fontFamily: tokens.font,
            }}
          />
        </label>

        <label style={{ display: 'block', margin: `${tokens.space(2)}px 0` }}>
          <span style={{ display: 'block', fontSize: 13, color: tokens.color.muted, marginBottom: 4 }}>
            Unit / topic (optional — stamped on each student's history)
          </span>
          <input
            type="text"
            aria-label="Unit"
            value={unit}
            onChange={(e) => onUnitChange(e.target.value)}
            placeholder="e.g. The American Revolution"
            style={{
              width: '100%',
              maxWidth: 520,
              background: tokens.color.panelAlt,
              color: tokens.color.text,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.md,
              padding: '8px 12px',
              fontSize: 15,
              fontFamily: tokens.font,
            }}
          />
        </label>

        <ReviewScreenContainer
          batch={batch}
          messages={messages}
          mode={mode}
          runSend={runSend}
          setBatchStatus={(status) =>
            api.setBatchStatus(db, uid, batchId, status as 'sending' | 'sent')
          }
          onSent={onSent}
          emailById={emailById}
          unmessagedNames={unmessagedNames}
          subject={subject}
        />

        <p style={{ marginTop: 24 }}>
          <Link to="/home">← Back to Home</Link>
        </p>
      </main>
    </>
  );
}
