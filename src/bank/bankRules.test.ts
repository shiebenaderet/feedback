// src/bank/bankRules.test.ts
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "feedback-rules-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
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

const OWNER = "teacher-123";
const STRANGER = "intruder-999";

function entryPath(uid: string) {
  return ["teachers", uid, "bankEntries", "entry-1"] as const;
}

describe("bankEntries security rules", () => {
  it("lets the owner write and read their own bank entry", async () => {
    const ctx = testEnv.authenticatedContext(OWNER);
    const db = ctx.firestore();
    const ref = doc(db, ...entryPath(OWNER));
    await assertSucceeds(
      setDoc(ref, { templateText: "Hi {name}.", slots: [], tags: {} })
    );
    await assertSucceeds(getDoc(ref));
  });

  it("denies a different signed-in user reading the owner's bank entry", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), ...entryPath(OWNER)), {
        templateText: "Hi {name}.",
        slots: [],
        tags: {},
      });
    });
    const strangerDb = testEnv.authenticatedContext(STRANGER).firestore();
    await assertFails(getDoc(doc(strangerDb, ...entryPath(OWNER))));
  });

  it("denies an unauthenticated user reading any bank entry", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, ...entryPath(OWNER))));
  });
});
