// src/bank/bankRepo.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock the modular Firestore SDK ---
const mocks = vi.hoisted(() => ({
  collection: vi.fn(() => ({ __type: "collectionRef" })),
  doc: vi.fn(() => ({ id: "generated-id", __type: "docRef" })),
  addDoc: vi.fn(async (_ref: unknown, _payload: unknown) => ({ id: "new-id" })),
  setDoc: vi.fn(async (_ref: unknown, _payload: unknown) => undefined),
  deleteDoc: vi.fn(async () => undefined),
  getDocs: vi.fn(async () => ({
    docs: [
      {
        id: "e1",
        data: () => ({
          templateText: "Hi {name}.",
          slots: [{ key: "name", kind: "auto", hint: "" }],
          tags: { type: "success", area: "", objective: "", tone: "warm" },
        }),
      },
    ],
  })),
}));

vi.mock("firebase/firestore", () => ({
  collection: mocks.collection,
  doc: mocks.doc,
  addDoc: mocks.addDoc,
  setDoc: mocks.setDoc,
  deleteDoc: mocks.deleteDoc,
  getDocs: mocks.getDocs,
}));

// db is just an opaque handle passed through to the SDK.
const db = { __type: "firestore" } as never;

import { addBankEntry, updateBankEntry, deleteBankEntry, listBankEntries } from "./bankRepo";

const uid = "teacher-123";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bankRepo", () => {
  it("addBankEntry writes to teachers/{uid}/bankEntries and returns the new id", async () => {
    const id = await addBankEntry(db, uid, {
      templateText: "Hi {name}.",
      slots: [{ key: "name", kind: "auto", hint: "" }],
      tags: { type: "success", area: "", objective: "", tone: "warm" },
    });
    expect(mocks.collection).toHaveBeenCalledWith(db, "teachers", uid, "bankEntries");
    expect(mocks.addDoc).toHaveBeenCalledTimes(1);
    const [, payload] = mocks.addDoc.mock.calls[0];
    expect(payload).toMatchObject({ templateText: "Hi {name}." });
    expect(id).toBe("new-id");
  });

  it("updateBankEntry setDoc's the existing doc by id", async () => {
    await updateBankEntry(db, uid, "e1", {
      templateText: "Updated {name}.",
      slots: [{ key: "name", kind: "auto", hint: "" }],
      tags: { type: "growth", area: "", objective: "", tone: "firm" },
    });
    expect(mocks.doc).toHaveBeenCalledWith(db, "teachers", uid, "bankEntries", "e1");
    expect(mocks.setDoc).toHaveBeenCalledTimes(1);
    const [, payload] = mocks.setDoc.mock.calls[0];
    expect(payload).toMatchObject({ templateText: "Updated {name}." });
  });

  it("deleteBankEntry deletes the doc by id", async () => {
    await deleteBankEntry(db, uid, "e1");
    expect(mocks.doc).toHaveBeenCalledWith(db, "teachers", uid, "bankEntries", "e1");
    expect(mocks.deleteDoc).toHaveBeenCalledTimes(1);
  });

  it("listBankEntries maps docs to BankEntry objects with ids", async () => {
    const entries = await listBankEntries(db, uid);
    expect(mocks.collection).toHaveBeenCalledWith(db, "teachers", uid, "bankEntries");
    expect(entries).toEqual([
      {
        id: "e1",
        templateText: "Hi {name}.",
        slots: [{ key: "name", kind: "auto", hint: "" }],
        tags: { type: "success", area: "", objective: "", tone: "warm" },
      },
    ]);
  });
});
