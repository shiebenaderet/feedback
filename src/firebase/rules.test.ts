// src/firebase/rules.test.ts
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'feedback-rules-test';
const OWNER_UID = 'owner-uid';
const STRANGER_UID = 'stranger-uid';

let testEnv: RulesTestEnvironment;

describe('Firestore security rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    // Seed a student owned by OWNER_UID, bypassing rules.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `teachers/${OWNER_UID}/classes/c1/students/s1`), {
        name: 'Carlos',
        email: 'carlos@example.com',
      });
    });
  });

  it('lets the owner read their own student', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      getDoc(doc(ownerDb, `teachers/${OWNER_UID}/classes/c1/students/s1`)),
    );
  });

  it('lets the owner write under their own tree', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(ownerDb, `teachers/${OWNER_UID}/bankEntries/b1`), {
        templateText: 'Great work, {name}!',
      }),
    );
  });

  it('FORBIDS another signed-in account from reading the owner data', async () => {
    const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
    await assertFails(
      getDoc(doc(strangerDb, `teachers/${OWNER_UID}/classes/c1/students/s1`)),
    );
  });

  it('FORBIDS another account from writing into the owner tree', async () => {
    const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
    await assertFails(
      setDoc(doc(strangerDb, `teachers/${OWNER_UID}/classes/c1/students/s2`), {
        name: 'Injected',
      }),
    );
  });

  it('FORBIDS an unauthenticated client from reading owner data', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      getDoc(doc(anonDb, `teachers/${OWNER_UID}/classes/c1/students/s1`)),
    );
  });
});
