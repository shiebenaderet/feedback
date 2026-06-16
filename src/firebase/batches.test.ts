import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { createBatch } from './batches';

let testEnv: RulesTestEnvironment;
const UID = 'teacher-1';

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'feedback-batches-test',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
  await testEnv.clearFirestore();
});

function db(): Firestore {
  // authenticated teacher context, cast to the client Firestore type the fns expect
  return testEnv.authenticatedContext(UID).firestore() as unknown as Firestore;
}

describe('createBatch', () => {
  it('writes teachers/{uid}/batches/{batchId} with draft status and returns the id', async () => {
    const database = db();
    const batchId = await createBatch(database, UID, {
      classId: 'class-9',
      sharedHeader: 'End of year — Period 3 Biology',
    });

    expect(typeof batchId).toBe('string');
    expect(batchId.length).toBeGreaterThan(0);

    const snap = await getDoc(doc(database, `teachers/${UID}/batches/${batchId}`));
    expect(snap.exists()).toBe(true);
    expect(snap.data()).toMatchObject({
      classId: 'class-9',
      sharedHeader: 'End of year — Period 3 Biology',
      status: 'draft',
    });
  });
});

import { setBatchStatus } from './batches';

describe('setBatchStatus', () => {
  it("updates an existing batch's status to 'sending' then 'sent'", async () => {
    const database = db();
    const batchId = await createBatch(database, UID, {
      classId: 'class-9',
      sharedHeader: 'EOY',
    });

    await setBatchStatus(database, UID, batchId, 'sending');
    let snap = await getDoc(doc(database, `teachers/${UID}/batches/${batchId}`));
    expect(snap.data()?.status).toBe('sending');

    await setBatchStatus(database, UID, batchId, 'sent');
    snap = await getDoc(doc(database, `teachers/${UID}/batches/${batchId}`));
    expect(snap.data()?.status).toBe('sent');
  });
});
