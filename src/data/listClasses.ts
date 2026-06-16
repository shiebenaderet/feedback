import {
  collection as fbCollection,
  getDocs as fbGetDocs,
  type Firestore,
} from 'firebase/firestore';
import type { ClassMeta } from '../types';

export interface FirestoreReadDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
}

const defaultDeps: FirestoreReadDeps = {
  collection: fbCollection,
  getDocs: fbGetDocs,
};

/** List the signed-in teacher's classes from teachers/{uid}/classes. */
export async function listClasses(
  db: Firestore,
  uid: string,
  deps: FirestoreReadDeps = defaultDeps,
): Promise<ClassMeta[]> {
  const { collection, getDocs } = deps;
  const snap = await getDocs(collection(db, `teachers/${uid}/classes`));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<ClassMeta, 'id'>;
    const meta: ClassMeta = { id: d.id, name: data.name };
    if (data.period !== undefined) meta.period = data.period;
    if (data.semester !== undefined) meta.semester = data.semester;
    if (data.unit !== undefined) meta.unit = data.unit;
    return meta;
  });
}
