// src/bank/bankRepo.ts
import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  getDocs,
  type Firestore,
} from "firebase/firestore";
import type { BankEntry, BankEntryInput } from "./types";

// BankEntryInput = { templateText; slots; tags }
// BankEntry      = BankEntryInput & { id: string }

// All bank entries live under the owning teacher: teachers/{uid}/bankEntries.
function bankCollection(db: Firestore, uid: string) {
  return collection(db, "teachers", uid, "bankEntries");
}

/** Creates a new bank entry; returns the generated document id. */
export async function addBankEntry(
  db: Firestore,
  uid: string,
  input: BankEntryInput
): Promise<string> {
  const ref = await addDoc(bankCollection(db, uid), { ...input });
  return ref.id;
}

/** Overwrites an existing bank entry's editable fields. */
export async function updateBankEntry(
  db: Firestore,
  uid: string,
  id: string,
  input: BankEntryInput
): Promise<void> {
  await setDoc(doc(db, "teachers", uid, "bankEntries", id), { ...input });
}

/** Deletes a bank entry by id. */
export async function deleteBankEntry(
  db: Firestore,
  uid: string,
  id: string
): Promise<void> {
  await deleteDoc(doc(db, "teachers", uid, "bankEntries", id));
}

/** Reads all of the teacher's bank entries as BankEntry objects. */
export async function listBankEntries(
  db: Firestore,
  uid: string
): Promise<BankEntry[]> {
  const snapshot = await getDocs(bankCollection(db, uid));
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as BankEntryInput),
  }));
}
