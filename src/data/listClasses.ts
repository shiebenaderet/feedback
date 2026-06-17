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

/** Options for listClasses. Defaults to active-only (archived hidden). */
export interface ListClassesOptions {
  includeArchived?: boolean;
}

/**
 * List the signed-in teacher's classes from teachers/{uid}/classes.
 *
 * By default archived classes (archived === true) are filtered out; pass
 * { includeArchived: true } to get the full set. `deps` keeps its 3rd-position
 * slot so existing 2- and 3-arg callers are unaffected.
 */
export async function listClasses(
  db: Firestore,
  uid: string,
  deps: FirestoreReadDeps = defaultDeps,
  options: ListClassesOptions = {},
): Promise<ClassMeta[]> {
  const { collection, getDocs } = deps;
  const { includeArchived = false } = options;
  const snap = await getDocs(collection(db, `teachers/${uid}/classes`));
  const classes = snap.docs.map((d) => {
    const data = d.data() as Omit<ClassMeta, 'id'>;
    const meta: ClassMeta = { id: d.id, name: data.name };
    if (data.period !== undefined) meta.period = data.period;
    if (data.semester !== undefined) meta.semester = data.semester;
    if (data.unit !== undefined) meta.unit = data.unit;
    if (data.archived !== undefined) meta.archived = data.archived;
    return meta;
  });
  return includeArchived ? classes : classes.filter((c) => c.archived !== true);
}
