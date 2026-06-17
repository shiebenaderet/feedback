import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  getDocs as fbGetDocs,
  type Firestore,
} from 'firebase/firestore';
import type { Year } from '../types';
import { currentSchoolYearLabel } from './currentSchoolYearLabel';

/** Injectable Firestore primitives for year writes. */
export interface YearWriteDeps {
  collection: typeof fbCollection;
  addDoc: typeof fbAddDoc;
}

const defaultWriteDeps: YearWriteDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
};

/**
 * Create a year under teachers/{uid}/years and return its new id.
 */
export async function createYear(
  db: Firestore,
  uid: string,
  label: string,
  deps: YearWriteDeps = defaultWriteDeps,
): Promise<string> {
  const { collection, addDoc } = deps;
  const ref = collection(db, `teachers/${uid}/years`);
  const docRef = await addDoc(ref, { label });
  return docRef.id;
}

/** Injectable primitives for the get-or-create helper. */
export interface YearGetOrCreateDeps extends YearWriteDeps {
  getDocs: typeof fbGetDocs;
}

const defaultGetOrCreateDeps: YearGetOrCreateDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
  getDocs: fbGetDocs,
};

/**
 * Return the id of the year whose label matches `label`, creating it if none
 * exists. Idempotent per label: a second call with the same label reuses the
 * existing year rather than duplicating it.
 */
export async function getOrCreateCurrentYear(
  db: Firestore,
  uid: string,
  label: string = currentSchoolYearLabel(),
  deps: YearGetOrCreateDeps = defaultGetOrCreateDeps,
): Promise<string> {
  const { collection, addDoc, getDocs } = deps;
  const ref = collection(db, `teachers/${uid}/years`);
  const snap = await getDocs(ref);
  // A read-then-write race (or historical double-mounts) can leave MORE THAN ONE
  // year doc with the same label. find() returns them in Firestore's unspecified
  // order, so different sessions could resolve to different year docs — stranding
  // a teacher's courses under one and showing an empty one under another. Pick the
  // matching year with the smallest doc id so EVERY session resolves to the SAME
  // year deterministically, regardless of how many duplicates exist.
  const matches = snap.docs
    .filter((d) => (d.data() as Year).label === label)
    .map((d) => d.id)
    .sort();
  if (matches.length > 0) return matches[0];
  const docRef = await addDoc(ref, { label });
  return docRef.id;
}
