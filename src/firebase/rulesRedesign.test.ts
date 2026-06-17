// Security-rules test for the redesign's deep nested tree. The existing
// `match /teachers/{ownerUid}/{document=**}` recursive wildcard already covers
// every depth (years → courses → periods → students → feedbackHistory); this
// test proves it at the deepest path. Emulator-backed (JDK 21+); excluded from
// the default vitest run, executed via `npm run test:rules`.
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const OWNER = 'owner-uid';
const STRANGER = 'stranger-uid';

// teachers/{uid}/years/y1/courses/c1/periods/p1/students/s1/feedbackHistory/h1
function historyPath(uid: string) {
  return [
    'teachers', uid, 'years', 'y1', 'courses', 'c1',
    'periods', 'p1', 'students', 's1', 'feedbackHistory', 'h1',
  ] as const;
}

describe('redesign nested-tree security rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'feedback-redesign-rules-test',
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
  });

  it('lets the owner write and read a deep feedbackHistory entry', async () => {
    const db = testEnv.authenticatedContext(OWNER).firestore();
    const ref = doc(db, ...historyPath(OWNER));
    await assertSucceeds(setDoc(ref, { finalText: 'Great work', sentAt: 1 }));
    await assertSucceeds(getDoc(ref));
  });

  it("denies a different signed-in user reading the owner's feedbackHistory", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), ...historyPath(OWNER)), { finalText: 'x' });
    });
    const strangerDb = testEnv.authenticatedContext(STRANGER).firestore();
    await assertFails(getDoc(doc(strangerDb, ...historyPath(OWNER))));
  });

  it('denies an unauthenticated client reading any feedbackHistory', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, ...historyPath(OWNER))));
  });
});
