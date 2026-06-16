// src/compose/rosterProgress.ts

export interface RosterStudent {
  id: string;
  name: string;
}

export interface RosterMessage {
  studentId: string;
  finalText: string;
  status: 'draft' | 'sent' | 'failed';
}

export interface ProgressResult {
  doneCount: number;
  total: number;
  doneIds: Set<string>;
}

/**
 * A student is "done" when there is a message for them with non-empty finalText,
 * regardless of send status. Powers the left-panel roster progress indicator.
 */
export function rosterProgress(
  students: RosterStudent[],
  messages: RosterMessage[],
): ProgressResult {
  const validIds = new Set(students.map((s) => s.id));
  const doneIds = new Set<string>();

  for (const m of messages) {
    if (validIds.has(m.studentId) && m.finalText.trim() !== '') {
      doneIds.add(m.studentId);
    }
  }

  return { doneCount: doneIds.size, total: students.length, doneIds };
}
