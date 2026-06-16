import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getDoc, doc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { MessageDraft } from '../types';
import { saveMessageDraft } from './messages';

let testEnv: RulesTestEnvironment;
const UID = 'teacher-1';
const BATCH_ID = 'batch-abc';

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'feedback-messages-test',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
  await testEnv.clearFirestore();
});

function db(): Firestore {
  return testEnv.authenticatedContext(UID).firestore() as unknown as Firestore;
}

const draft: MessageDraft = {
  studentId: 'stu-7',
  name: 'Carlos',
  usedEntries: ['entry-1', 'entry-2'],
  slotValues: { name: 'Carlos', semester: 'Spring', highlight: 'your lab writeups' },
  finalText: 'Hi Carlos, great work this Spring on your lab writeups...',
  status: 'draft',
};

describe('saveMessageDraft', () => {
  it('writes to teachers/{uid}/batches/{batchId}/messages/{studentId} keyed by studentId', async () => {
    const database = db();
    await saveMessageDraft(database, UID, BATCH_ID, draft);

    const snap = await getDoc(
      doc(database, `teachers/${UID}/batches/${BATCH_ID}/messages/${draft.studentId}`),
    );
    expect(snap.exists()).toBe(true);
    expect(snap.data()).toEqual(draft);
  });

  it('does NOT write to any top-level messages collection (old path is gone)', async () => {
    const database = db();
    await saveMessageDraft(database, UID, BATCH_ID, draft);

    const stale = await getDoc(doc(database, `messages/${draft.studentId}`));
    expect(stale.exists()).toBe(false);
  });

  it('upserts in place — re-saving the same studentId overwrites, not duplicates', async () => {
    const database = db();
    await saveMessageDraft(database, UID, BATCH_ID, draft);
    await saveMessageDraft(database, UID, BATCH_ID, {
      ...draft,
      finalText: 'edited text',
    });

    const snap = await getDoc(
      doc(database, `teachers/${UID}/batches/${BATCH_ID}/messages/${draft.studentId}`),
    );
    expect(snap.data()?.finalText).toBe('edited text');
  });
});
