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
  const existing = snap.docs.find((d) => (d.data() as Year).label === label);
  if (existing) return existing.id;
  const docRef = await addDoc(ref, { label });
  return docRef.id;
}
