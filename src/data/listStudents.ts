import {
  collection as fbCollection,
  getDocs as fbGetDocs,
  type Firestore,
} from 'firebase/firestore';
import type { RosterStudent } from '../roster/RosterTable';

export interface FirestoreReadDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
}

const defaultDeps: FirestoreReadDeps = {
  collection: fbCollection,
  getDocs: fbGetDocs,
};

/**
 * Load a class's students from teachers/{uid}/classes/{classId}/students.
 * `period` defaults to '' when absent so RosterStudent stays fully populated.
 */
export async function listStudents(
  db: Firestore,
  uid: string,
  classId: string,
  deps: FirestoreReadDeps = defaultDeps,
): Promise<RosterStudent[]> {
  const { collection, getDocs } = deps;
  const snap = await getDocs(
    collection(db, `teachers/${uid}/classes/${classId}/students`),
  );
  return snap.docs.map((d) => {
    const data = d.data() as { name: string; email: string; period?: string };
    return {
      id: d.id,
      name: data.name,
      email: data.email,
      period: data.period ?? '',
    };
  });
}
