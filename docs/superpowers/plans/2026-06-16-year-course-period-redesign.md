# Year → Course → Period Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the app's structural spine — a Year → Course → Period → Roster hierarchy — and add a longitudinal feedback layer (per-student history + aggregate trends), while reusing the existing compose/send/bank/grammar engines intact.

**Architecture:** A new nested Firestore model under `teachers/{uid}/years/{yearId}/courses/{courseId}/periods/{periodId}/students/{studentId}`, with a durable `feedbackHistory` subcollection per student written on every send. A single config module (`src/feedback/taxonomy.ts`) owns the sentiment mapping, grading-period list, and tag categories so classification choices are revisitable without an overhaul; history stores raw `usedEntries` so trends are re-derivable. Top-nav + breadcrumb navigation; full B+C UI pass.

**Tech Stack:** Vite + React + TypeScript, Firebase (Auth + Firestore + Hosting), Vitest + React Testing Library, PapaParse. DI-style data fns `(db, uid, ...args, deps?)` with `vi.hoisted` Firestore mocks; emulator-backed tests excluded from the default `vitest run`.

**Spec:** `docs/superpowers/specs/2026-06-16-year-course-period-redesign.md`

---

## Build order (each phase independently shippable + deployable)

1. **Foundation** — taxonomy config, new types, year/course/period/student/feedbackHistory data layer, extended rules.
2. **Setup + Navigation + Home** — nav bar, breadcrumbs, setup screen, home dashboard, year bootstrap.
3. **Roster** — 3-way student entry (CSV+template, manual, paste) per period.
4. **Compose/Send re-point + write history** — point compose/send at the period tree, grading-period step, write `feedbackHistory` on send.
5. **History surfaces + Trends** — inline compose-history panel, per-student history page, trends aggregation + page.
6. **UI polish** — B+C design across every screen.

---

## Reconciliation & Conventions (BINDING — read before any task)

The six phases were drafted in parallel; a few diverged on names/signatures. These rules are **binding** and override any conflicting code inside a task body. The **Foundation phase is the source of truth** for data-layer names and signatures.

1. **Period-scoped student CRUD uses the Foundation names + signatures — there is no `*PeriodStudents` API.** Wherever a later phase imports `listPeriodStudents`/`savePeriodStudents`/`updatePeriodStudent`/`deletePeriodStudent`, use instead the Foundation `src/data/students.ts` exports, all of which take the full tree path:
   - `saveStudents(db, uid, yearId, courseId, periodId, students, deps?)`
   - `listStudents(db, uid, yearId, courseId, periodId, deps?)`
   - `updateStudent(db, uid, yearId, courseId, periodId, studentId, patch, deps?)`
   - `deleteStudent(db, uid, yearId, courseId, periodId, studentId, deps?)`
   Every caller threads `yearId` (from the active year / route), not just `courseId/periodId`.

2. **`listPeriods(db, uid, yearId, courseId, deps?)` — yearId is required** (Foundation signature). `Period` is `{ id, label, order }` and does **not** carry denormalized `courseId/yearId`. Callers that need the tree ids get them from the **route params + active year**, not from the Period object.

3. **Taxonomy accessor names (Foundation exports, used everywhere):**
   - Sentiment: **`deriveSentiment(type)`** — NOT `sentimentForType`. Any phase importing `sentimentForType` uses `deriveSentiment`.
   - Grading periods: **`GRADING_PERIODS`** (the ordered list). There is **no `CURRENT_GRADING_PERIOD`** export; the grading period is chosen by the teacher per batch (default the UI to the last list entry or a simple "Q1" — never auto-detect from a missing export).
   - Tag categories: **`TAG_CATEGORIES`**.

4. **Bank read is `listBankEntries` (existing `src/bank/bankRepo.ts` export) — there is no `listBank`.** Any phase importing `listBank` uses `listBankEntries(db, uid)`.

5. **The `Batch` type and `createBatch` MUST gain the tree ids + grading-period — this is the load-bearing seam connecting compose → review → feedbackHistory. Foundation owns it** (added as Foundation Task: "Extend Batch + createBatch/updateBatch"). The reconciled shapes:
   ```ts
   // src/types.ts
   export interface Batch {
     id: string;
     yearId: string;
     courseId: string;
     periodId: string;        // replaces the old classId as the roster target
     sharedHeader: string;
     status: 'draft' | 'sending' | 'sent';
     gradingPeriod?: GradingPeriod;   // stamped at the grading-period step before send
     label?: string;                  // optional free-text round label
   }
   ```
   ```ts
   // src/firebase/batches.ts — createBatch input + updateBatch patch widen accordingly
   export type NewBatchInput = Pick<Batch, 'yearId' | 'courseId' | 'periodId' | 'sharedHeader'>;
   // createBatch writes status:'draft' + the four ids/header.
   // setBatchStatus unchanged. updateBatch patch widens to
   //   Partial<Pick<Batch, 'sharedHeader' | 'gradingPeriod' | 'label'>>.
   ```
   `writeFeedbackHistory` sources `{ yearId, courseId, periodId, gradingPeriod, label }` from the batch (now that they exist), plus the sent `MessageDraft`.

6. **`feedbackHistory` always stores raw `usedEntries` (bank entry ids), unfiltered.** Trend aggregation (Phase 5) re-derives sentiment/areas from `usedEntries` + the bank via `deriveSentiment`, rather than trusting the stored derived tags — so a future taxonomy change reclassifies old history correctly. Do not drop `usedEntries` as "dead code."

7. **A `rosterSize(db, uid, yearId, courseId, periodId)` helper** (Home's per-period count) is just `listStudents(...).length` — implement it as a one-line wrapper in `src/data/students.ts`, not a separate Firestore read.

8. **`standard` bank tag:** `BankTags` has no `standard` field yet (deferred content). `deriveHistoryTags` reads it via a safe cast `(entry.tags as { standard?: string }).standard` and leaves `standards: []` until a content task adds it. Keep the cast; do not add the field now.

---


## Phase 1 — Foundation

## PHASE 1 — FOUNDATION

This phase builds the config-driven taxonomy, the new canonical types, the DI-style data layer
for the year/course/period/student/feedbackHistory tree, and the extended security rules. Every
task follows the existing repo conventions verified in the codebase:

- **DI data fns** take `(db, uid, ...args, deps?)` where `deps` is an injectable bag of Firestore
  primitives defaulting to the real SDK (see `src/data/createClass.ts`, `listClasses.ts`).
- **Cascade/multi-primitive tests** mock `firebase/firestore` via `vi.hoisted` (see
  `src/data/deleteClass.test.ts`); simple fns inject `deps` directly (see `listClasses.test.ts`).
- **Client-generated ids** via `doc(collection(db, path))` then `ref.id` (see `firebase/batches.ts`).
- The default `vitest run` does NOT include `src/firebase/rules.test.ts` — it runs only under
  `npm run test:rules` against the emulator (see `vitest.rules.config.ts`).

Run unit tests with `npx vitest run <file>`. Commit after each task.

---

### Task F1: `src/feedback/taxonomy.ts`: sentiment derivation + grading periods + tag categories

The single source of truth for the sentiment mapping, the grading-period list, and tag categories.
`send/`, `history/`, and `trends/` all import from here — nothing downstream hardcodes these.

**Step 1 — Write the failing test (REAL code).**

Create `src/feedback/taxonomy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  deriveSentiment,
  GRADING_PERIODS,
  TAG_CATEGORIES,
  SENTIMENT_BY_TYPE,
  type Sentiment,
  type GradingPeriod,
  type TagCategory,
} from './taxonomy';

describe('taxonomy: deriveSentiment', () => {
  it('maps success -> strength', () => {
    expect(deriveSentiment('success')).toBe('strength');
  });

  it('maps growth -> growth', () => {
    expect(deriveSentiment('growth')).toBe('growth');
  });

  it('maps behavior -> neutral', () => {
    expect(deriveSentiment('behavior')).toBe('neutral');
  });

  it('maps skill -> neutral', () => {
    expect(deriveSentiment('skill')).toBe('neutral');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(deriveSentiment('  SUCCESS ')).toBe('strength');
    expect(deriveSentiment('Growth')).toBe('growth');
  });

  it('falls back to neutral for an unknown or empty type', () => {
    expect(deriveSentiment('mystery')).toBe('neutral');
    expect(deriveSentiment('')).toBe('neutral');
    expect(deriveSentiment(undefined)).toBe('neutral');
  });

  it('every value in SENTIMENT_BY_TYPE is a valid Sentiment', () => {
    const valid: Sentiment[] = ['strength', 'growth', 'neutral'];
    for (const s of Object.values(SENTIMENT_BY_TYPE)) {
      expect(valid).toContain(s);
    }
  });
});

describe('taxonomy: GRADING_PERIODS', () => {
  it('is exactly the ordered pilot list', () => {
    expect(GRADING_PERIODS).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'S1', 'S2', 'EOY']);
  });

  it('is a readonly tuple whose members are assignable to GradingPeriod', () => {
    const first: GradingPeriod = GRADING_PERIODS[0];
    expect(first).toBe('Q1');
    // EOY is a member
    expect(GRADING_PERIODS).toContain<GradingPeriod>('EOY');
  });
});

describe('taxonomy: TAG_CATEGORIES', () => {
  it('lists the derived feedback-history tag categories', () => {
    expect(TAG_CATEGORIES).toEqual(['areas', 'sentiments', 'standards']);
  });

  it('members are assignable to TagCategory', () => {
    const c: TagCategory = TAG_CATEGORIES[0];
    expect(c).toBe('areas');
  });
});
```

**Step 2 — Run; expect FAIL.**

```bash
npx vitest run src/feedback/taxonomy.test.ts
```

Expect failure: `Failed to resolve import "./taxonomy"` — the module does not exist yet.

**Step 3 — Minimal implementation (REAL code).**

Create `src/feedback/taxonomy.ts`:

```ts
// src/feedback/taxonomy.ts
// SINGLE source of truth for the feedback taxonomy: how a bank entry's `type`
// tag derives into a longitudinal sentiment, the ordered grading-period list,
// and the derived tag-category names. send/, history/, and trends/ import from
// here so the mapping can be revised in ONE place and history re-derived under it.

/** The longitudinal sentiment a feedback item contributes to a student's trend. */
export type Sentiment = 'strength' | 'growth' | 'neutral';

/**
 * Canonical mapping from a bank entry `type` tag to its sentiment.
 * Keys are lowercased type tags. Extend here — never branch on type elsewhere.
 */
export const SENTIMENT_BY_TYPE: Readonly<Record<string, Sentiment>> = {
  success: 'strength',
  growth: 'growth',
  behavior: 'neutral',
  skill: 'neutral',
};

/**
 * Derive the sentiment for a bank-entry `type` tag. Unknown, empty, or missing
 * types fall back to 'neutral' so an untagged entry never crashes a trend roll-up.
 */
export function deriveSentiment(type: string | undefined | null): Sentiment {
  if (!type) return 'neutral';
  const key = type.trim().toLowerCase();
  return SENTIMENT_BY_TYPE[key] ?? 'neutral';
}

/**
 * Ordered grading periods for the pilot. The order is meaningful: history views
 * and trend timelines render in this sequence. EOY (end-of-year) sits last.
 */
export const GRADING_PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'S1', 'S2', 'EOY'] as const;
export type GradingPeriod = (typeof GRADING_PERIODS)[number];

/**
 * The derived tag categories stored on a FeedbackHistoryEntry. `sentiments` is
 * produced by deriveSentiment; `areas`/`standards` come from the bank entry tags.
 */
export const TAG_CATEGORIES = ['areas', 'sentiments', 'standards'] as const;
export type TagCategory = (typeof TAG_CATEGORIES)[number];
```

**Step 4 — Run; expect PASS.**

```bash
npx vitest run src/feedback/taxonomy.test.ts
```

All assertions pass.

**Step 5 — Commit.**

```bash
git add src/feedback/taxonomy.ts src/feedback/taxonomy.test.ts
git commit -m "Add feedback taxonomy config (sentiment mapping, grading periods, tag categories)"
```

---

### Task F2: New canonical types: `Year`, `Course`, `Period`, `FeedbackHistoryEntry`

Add the redesign's domain types to `src/types.ts` (the single source of truth). `FeedbackHistoryEntry`
reuses `GradingPeriod` and `TagCategory`-shaped tags from the taxonomy module so the shapes stay aligned.

**Step 1 — Write the failing test (REAL code).**

Create `src/types.redesign.test.ts`:

```ts
// src/types.redesign.test.ts
import { describe, it, expect } from 'vitest';
import type {
  Year,
  Course,
  Period,
  FeedbackHistoryEntry,
} from './types';
import type { GradingPeriod } from './feedback/taxonomy';

describe('redesign canonical types (src/types.ts)', () => {
  it('Year has id/label', () => {
    const y: Year = { id: 'y2025', label: '2025–2026' };
    expect(Object.keys(y)).toEqual(expect.arrayContaining(['id', 'label']));
    expect(y.id).toBe('y2025');
    expect(y.label).toBe('2025–2026');
  });

  it('Course has id/name and optional archived', () => {
    const c: Course = { id: 'c1', name: 'Period 3 Biology' };
    expect(Object.keys(c)).toEqual(expect.arrayContaining(['id', 'name']));
    expect(c.archived).toBeUndefined();

    const archived: Course = { id: 'c2', name: 'Old Chem', archived: true };
    expect(archived.archived).toBe(true);
  });

  it('Period has id/label/order', () => {
    const p: Period = { id: 'p1', label: 'Q1', order: 0 };
    expect(Object.keys(p)).toEqual(expect.arrayContaining(['id', 'label', 'order']));
    expect(p.order).toBe(0);
  });

  it('FeedbackHistoryEntry carries ids, sentAt, gradingPeriod, finalText, derived tags, usedEntries', () => {
    const gradingPeriod: GradingPeriod = 'EOY';
    const entry: FeedbackHistoryEntry = {
      studentId: 's1',
      periodId: 'p1',
      courseId: 'c1',
      yearId: 'y2025',
      sentAt: 1718539200000,
      gradingPeriod,
      label: 'End-of-year note',
      finalText: 'Hi Carlos, this year you grew in lab precision.',
      tags: {
        areas: ['lab'],
        sentiments: ['growth'],
        standards: ['NGSS-HS-LS1'],
      },
      usedEntries: ['b1', 'b2'],
    };

    expect(Object.keys(entry)).toEqual(
      expect.arrayContaining([
        'studentId',
        'periodId',
        'courseId',
        'yearId',
        'sentAt',
        'gradingPeriod',
        'finalText',
        'tags',
        'usedEntries',
      ]),
    );
    expect(entry.tags.areas).toEqual(['lab']);
    expect(entry.tags.sentiments).toEqual(['growth']);
    expect(entry.tags.standards).toEqual(['NGSS-HS-LS1']);
    expect(entry.usedEntries).toEqual(['b1', 'b2']);
    expect(entry.gradingPeriod).toBe('EOY');
  });

  it('FeedbackHistoryEntry.label is optional', () => {
    const entry: FeedbackHistoryEntry = {
      studentId: 's1',
      periodId: 'p1',
      courseId: 'c1',
      yearId: 'y2025',
      sentAt: 1718539200000,
      gradingPeriod: 'Q1',
      finalText: 'Great quarter.',
      tags: { areas: [], sentiments: [], standards: [] },
      usedEntries: [],
    };
    expect(entry.label).toBeUndefined();
  });
});
```

**Step 2 — Run; expect FAIL.**

```bash
npx vitest run src/types.redesign.test.ts
```

Expect failure: the named exports `Year`, `Course`, `Period`, `FeedbackHistoryEntry` are not exported
from `./types` (TS error / `has no exported member`).

**Step 3 — Minimal implementation (REAL code).**

Append to `src/types.ts` (after the existing `AUTO_SLOT_KEYS` block):

```ts
// ---------------------------------------------------------------------------
// REDESIGN domain types: Year > Course > Period > Student, with a longitudinal
// feedbackHistory layer. Firestore paths:
//   teachers/{uid}/years/{yearId}/courses/{courseId}/periods/{periodId}/students/{studentId}
//   .../students/{studentId}/feedbackHistory/{entryId}
// ---------------------------------------------------------------------------

import type { GradingPeriod } from './feedback/taxonomy';

/** A school year (e.g. "2025–2026"). Top of the new hierarchy. */
export interface Year {
  id: string;
  label: string;
}

/** A course/section within a year (e.g. "Period 3 Biology"). */
export interface Course {
  id: string;
  name: string;
  archived?: boolean;
}

/** A grading period within a course; `order` fixes its position in the year. */
export interface Period {
  id: string;
  label: string;
  order: number;
}

/**
 * One piece of feedback sent to one student, written on send/mark-sent
 * INDEPENDENTLY of batches. Stores raw `usedEntries` (bank ids) PLUS derived
 * `tags` so trends are re-derivable under a future taxonomy mapping.
 */
export interface FeedbackHistoryEntry {
  studentId: string;
  periodId: string;
  courseId: string;
  yearId: string;
  /** Epoch millis when the message was sent / marked sent. */
  sentAt: number;
  /** Which grading period this feedback belongs to (from taxonomy). */
  gradingPeriod: GradingPeriod;
  /** Optional human label, e.g. the shared header / batch name. */
  label?: string;
  /** The exact message text the student received. */
  finalText: string;
  /** Derived tags, re-derivable from usedEntries under a future mapping. */
  tags: {
    areas: string[];
    sentiments: string[];
    standards: string[];
  };
  /** Raw bank-entry ids that produced this message — the source of truth. */
  usedEntries: string[];
}
```

**Step 4 — Run; expect PASS.**

```bash
npx vitest run src/types.redesign.test.ts
```

All assertions pass. Also confirm the existing types test still passes:

```bash
npx vitest run src/types.test.ts
```

**Step 5 — Commit.**

```bash
git add src/types.ts src/types.redesign.test.ts
git commit -m "Add Year/Course/Period/FeedbackHistoryEntry canonical types"
```

---

### Task F3: Extend `Batch` with tree ids + grading-period, update createBatch/updateBatch

Per Reconciliation rule 5 — the load-bearing seam connecting compose → review → feedbackHistory.
`Batch` gains `yearId`/`courseId`/`periodId` (replacing `classId`) plus optional `gradingPeriod`/`label`,
and `createBatch`/`updateBatch` are updated to write/patch them.

**Step 1 — Write the failing test (REAL code).** Create `src/types.batch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Batch } from './types';
import type { GradingPeriod } from './feedback/taxonomy';

describe('Batch carries the full tree + grading-period', () => {
  it('has yearId/courseId/periodId, sharedHeader, status', () => {
    const b: Batch = {
      id: 'b1', yearId: 'y1', courseId: 'c1', periodId: 'p1',
      sharedHeader: 'EOY', status: 'draft',
    };
    expect(Object.keys(b)).toEqual(
      expect.arrayContaining(['id', 'yearId', 'courseId', 'periodId', 'sharedHeader', 'status']),
    );
  });

  it('accepts an optional gradingPeriod + label', () => {
    const gp: GradingPeriod = 'Q2';
    const b: Batch = {
      id: 'b2', yearId: 'y1', courseId: 'c1', periodId: 'p1',
      sharedHeader: 'Note', status: 'sent', gradingPeriod: gp, label: 'Unit 3',
    };
    expect(b.gradingPeriod).toBe('Q2');
    expect(b.label).toBe('Unit 3');
  });
});
```

**Step 2 — Run; expect FAIL.** `npx vitest run src/types.batch.test.ts` — `yearId`/`courseId`/`periodId`/`gradingPeriod`/`label` are not on `Batch` yet.

**Step 3 — Minimal implementation (REAL code).** Replace the `Batch` interface in `src/types.ts`:

```ts
import type { GradingPeriod } from './feedback/taxonomy';

export interface Batch {
  id: string;
  yearId: string;
  courseId: string;
  periodId: string; // replaces the old classId as the roster target
  sharedHeader: string;
  status: 'draft' | 'sending' | 'sent';
  gradingPeriod?: GradingPeriod; // stamped at the grading-period step before send
  label?: string; // optional free-text round label
}
```

**Step 4 — Run; expect PASS.** `npx vitest run src/types.batch.test.ts` passes.

**Step 5 — Update createBatch/updateBatch (REAL code).** In `src/firebase/batches.ts`, widen the input/patch and write the tree ids. Replace the `NewBatchInput` type, `createBatch` body, and `updateBatch` patch type:

```ts
import type { Batch } from '../types';

export type NewBatchInput = Pick<Batch, 'yearId' | 'courseId' | 'periodId' | 'sharedHeader'>;

// createBatch: write a new doc id under teachers/{uid}/batches with status draft + the four ids/header.
export async function createBatch(
  db: Firestore, uid: string, input: NewBatchInput, deps: BatchWriteDeps = defaultDeps,
): Promise<string> {
  const { collection, doc, setDoc } = deps;
  const ref = doc(collection(db, `teachers/${uid}/batches`));
  const batch: Batch = {
    id: ref.id,
    yearId: input.yearId,
    courseId: input.courseId,
    periodId: input.periodId,
    sharedHeader: input.sharedHeader,
    status: 'draft',
  };
  await setDoc(ref, batch);
  return ref.id;
}

// updateBatch patch widens to cover the shared header AND the grading-period stamp.
export async function updateBatch(
  db: Firestore, uid: string, batchId: string,
  patch: Partial<Pick<Batch, 'sharedHeader' | 'gradingPeriod' | 'label'>>,
  deps: BatchUpdateDeps = defaultUpdateDeps,
): Promise<void> {
  const { doc, updateDoc } = deps;
  await updateDoc(doc(db, `teachers/${uid}/batches/${batchId}`), patch);
}
```

Update `src/firebase/batches.test.ts` so createBatch is called with `{yearId,courseId,periodId,sharedHeader}` and asserts the doc has all three ids + `status:'draft'`; add an updateBatch case asserting a `{gradingPeriod:'Q2'}` patch is written. (These are emulator-backed tests, excluded from the default run; verify via `npm run test:rules` or trust the type-check.)

**Step 6 — Run unit + tsc.** `npx vitest run src/types.batch.test.ts` passes; `npx tsc --noEmit` is clean (callers updated in Phase 4). Existing `Batch` literals elsewhere will fail tsc until Phase 4 re-points them — that is expected; this task only lands the type + data fns.

**Step 7 — Commit.**

```bash
git add src/types.ts src/types.batch.test.ts src/firebase/batches.ts src/firebase/batches.test.ts
git commit -m "Extend Batch with year/course/period ids + grading-period; update createBatch/updateBatch"
```


---

### Task F4: `createYear` / `getOrCreateCurrentYear`

Create a year doc and a helper that returns the current year's id, creating it on first use. Path:
`teachers/{uid}/years/{yearId}`.

**Step 1 — Write the failing test (REAL code).**

Create `src/data/years.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createYear, getOrCreateCurrentYear } from './years';

describe('createYear', () => {
  it('writes to teachers/{uid}/years and returns the new yearId', async () => {
    const uid = 'teacher-1';
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'year-xyz' }));

    const yearId = await createYear(db as any, uid, '2025–2026', { collection, addDoc } as any);

    expect(yearId).toBe('year-xyz');
    expect(collection).toHaveBeenCalledWith(db, `teachers/${uid}/years`);
    expect(addDoc.mock.calls[0][1]).toEqual({ label: '2025–2026' });
  });
});

describe('getOrCreateCurrentYear', () => {
  it('returns the id of an existing matching year without writing', async () => {
    const uid = 'teacher-1';
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => ({
      docs: [{ id: 'year-existing', data: () => ({ label: '2025–2026' }) }],
    }));
    const addDoc = vi.fn();

    const yearId = await getOrCreateCurrentYear(
      db as any,
      uid,
      '2025–2026',
      { collection, getDocs, addDoc } as any,
    );

    expect(yearId).toBe('year-existing');
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('creates the year when no doc with that label exists', async () => {
    const uid = 'teacher-1';
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => ({ docs: [] }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'year-new' }));

    const yearId = await getOrCreateCurrentYear(
      db as any,
      uid,
      '2026–2027',
      { collection, getDocs, addDoc } as any,
    );

    expect(yearId).toBe('year-new');
    expect(addDoc).toHaveBeenCalledWith({ __path: `teachers/${uid}/years` }, { label: '2026–2027' });
  });
});
```

**Step 2 — Run; expect FAIL.**

```bash
npx vitest run src/data/years.test.ts
```

Expect failure: `Failed to resolve import "./years"`.

**Step 3 — Minimal implementation (REAL code).**

Create `src/data/years.ts`:

```ts
import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  getDocs as fbGetDocs,
  type Firestore,
} from 'firebase/firestore';
import type { Year } from '../types';

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
  label: string,
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
```

**Step 4 — Run; expect PASS.**

```bash
npx vitest run src/data/years.test.ts
```

**Step 5 — Commit.**

```bash
git add src/data/years.ts src/data/years.test.ts
git commit -m "Add createYear and getOrCreateCurrentYear data fns"
```

---

### Task F5: `createCourse` / `listCourses`

Create a course under a year and list a year's courses (active-only by default, `includeArchived`
to get all). Path: `teachers/{uid}/years/{yearId}/courses/{courseId}`. Mirrors `createClass`/`listClasses`.

**Step 1 — Write the failing test (REAL code).**

Create `src/data/courses.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createCourse, listCourses } from './courses';
import type { Course } from '../types';

const uid = 'teacher-1';
const yearId = 'y2025';

describe('createCourse', () => {
  it('writes to teachers/{uid}/years/{yearId}/courses and returns the new id', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'course-1' }));

    const courseId = await createCourse(
      db as any,
      uid,
      yearId,
      'Period 3 Biology',
      { collection, addDoc } as any,
    );

    expect(courseId).toBe('course-1');
    expect(collection).toHaveBeenCalledWith(db, `teachers/${uid}/years/${yearId}/courses`);
    expect(addDoc.mock.calls[0][1]).toEqual({ name: 'Period 3 Biology' });
  });
});

describe('listCourses', () => {
  const snapshot = {
    docs: [
      { id: 'c-a', data: () => ({ name: 'Bio' }) },
      { id: 'c-z', data: () => ({ name: 'Old', archived: true }) },
    ],
  };

  it('reads the courses subcollection and maps to Course[], hiding archived by default', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => snapshot);

    const result = await listCourses(db as any, uid, yearId, { collection, getDocs } as any);

    expect(collection).toHaveBeenCalledWith(db, `teachers/${uid}/years/${yearId}/courses`);
    const expected: Course[] = [{ id: 'c-a', name: 'Bio' }];
    expect(result).toEqual(expected);
  });

  it('includes archived courses when includeArchived is true', async () => {
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => snapshot);

    const result = await listCourses(
      { __fake: true } as any,
      uid,
      yearId,
      { collection, getDocs } as any,
      { includeArchived: true },
    );

    expect(result.map((c) => c.id)).toEqual(['c-a', 'c-z']);
    expect(result.find((c) => c.id === 'c-z')?.archived).toBe(true);
  });
});
```

**Step 2 — Run; expect FAIL.**

```bash
npx vitest run src/data/courses.test.ts
```

Expect failure: `Failed to resolve import "./courses"`.

**Step 3 — Minimal implementation (REAL code).**

Create `src/data/courses.ts`:

```ts
import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  getDocs as fbGetDocs,
  type Firestore,
} from 'firebase/firestore';
import type { Course } from '../types';

const coursesPath = (uid: string, yearId: string) =>
  `teachers/${uid}/years/${yearId}/courses`;

/** Injectable Firestore primitives for course writes. */
export interface CourseWriteDeps {
  collection: typeof fbCollection;
  addDoc: typeof fbAddDoc;
}

const defaultWriteDeps: CourseWriteDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
};

/**
 * Create a course under teachers/{uid}/years/{yearId}/courses and return its id.
 */
export async function createCourse(
  db: Firestore,
  uid: string,
  yearId: string,
  name: string,
  deps: CourseWriteDeps = defaultWriteDeps,
): Promise<string> {
  const { collection, addDoc } = deps;
  const ref = collection(db, coursesPath(uid, yearId));
  const docRef = await addDoc(ref, { name });
  return docRef.id;
}

/** Injectable Firestore primitives for course reads. */
export interface CourseReadDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
}

const defaultReadDeps: CourseReadDeps = {
  collection: fbCollection,
  getDocs: fbGetDocs,
};

/** Defaults to active-only (archived hidden). */
export interface ListCoursesOptions {
  includeArchived?: boolean;
}

/**
 * List a year's courses. By default archived courses (archived === true) are
 * filtered out; pass { includeArchived: true } for the full set.
 */
export async function listCourses(
  db: Firestore,
  uid: string,
  yearId: string,
  deps: CourseReadDeps = defaultReadDeps,
  options: ListCoursesOptions = {},
): Promise<Course[]> {
  const { collection, getDocs } = deps;
  const { includeArchived = false } = options;
  const snap = await getDocs(collection(db, coursesPath(uid, yearId)));
  const courses = snap.docs.map((d) => {
    const data = d.data() as Omit<Course, 'id'>;
    const course: Course = { id: d.id, name: data.name };
    if (data.archived !== undefined) course.archived = data.archived;
    return course;
  });
  return includeArchived ? courses : courses.filter((c) => c.archived !== true);
}
```

**Step 4 — Run; expect PASS.**

```bash
npx vitest run src/data/courses.test.ts
```

**Step 5 — Commit.**

```bash
git add src/data/courses.ts src/data/courses.test.ts
git commit -m "Add createCourse and listCourses (active-only + includeArchived)"
```

---

### Task F6: `renameCourse` / `archiveCourse`

Patch a course's name and toggle its archived flag. Path:
`teachers/{uid}/years/{yearId}/courses/{courseId}`. Mirrors `renameClass`/`archiveClass`.

**Step 1 — Write the failing test (REAL code).**

Create `src/data/renameCourse.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { renameCourse, archiveCourse } from './renameCourse';

const uid = 'teacher-1';
const yearId = 'y2025';
const courseId = 'c1';
const path = `teachers/${uid}/years/${yearId}/courses/${courseId}`;

describe('renameCourse', () => {
  it('updates the name at the nested course path', async () => {
    const db = { __fake: true };
    const doc = vi.fn((_db: unknown, p: string) => ({ __path: p }));
    const updateDoc = vi.fn(async () => undefined);

    await renameCourse(db as any, uid, yearId, courseId, 'New Name', { doc, updateDoc } as any);

    expect(doc).toHaveBeenCalledWith(db, path);
    expect(updateDoc).toHaveBeenCalledWith({ __path: path }, { name: 'New Name' });
  });
});

describe('archiveCourse', () => {
  it('sets archived=true', async () => {
    const db = { __fake: true };
    const doc = vi.fn((_db: unknown, p: string) => ({ __path: p }));
    const updateDoc = vi.fn(async () => undefined);

    await archiveCourse(db as any, uid, yearId, courseId, true, { doc, updateDoc } as any);

    expect(updateDoc).toHaveBeenCalledWith({ __path: path }, { archived: true });
  });

  it('clears archived with false (restore)', async () => {
    const db = { __fake: true };
    const doc = vi.fn((_db: unknown, p: string) => ({ __path: p }));
    const updateDoc = vi.fn(async () => undefined);

    await archiveCourse(db as any, uid, yearId, courseId, false, { doc, updateDoc } as any);

    expect(updateDoc).toHaveBeenCalledWith({ __path: path }, { archived: false });
  });
});
```

**Step 2 — Run; expect FAIL.**

```bash
npx vitest run src/data/renameCourse.test.ts
```

Expect failure: `Failed to resolve import "./renameCourse"`.

**Step 3 — Minimal implementation (REAL code).**

Create `src/data/renameCourse.ts`:

```ts
import {
  doc as fbDoc,
  updateDoc as fbUpdateDoc,
  type Firestore,
} from 'firebase/firestore';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface CourseUpdateDeps {
  doc: typeof fbDoc;
  updateDoc: typeof fbUpdateDoc;
}

export const defaultCourseUpdateDeps: CourseUpdateDeps = {
  doc: fbDoc,
  updateDoc: fbUpdateDoc,
};

const coursePath = (uid: string, yearId: string, courseId: string) =>
  `teachers/${uid}/years/${yearId}/courses/${courseId}`;

/** Rename a course (its `name` field) at the nested course path. */
export async function renameCourse(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  name: string,
  deps: CourseUpdateDeps = defaultCourseUpdateDeps,
): Promise<void> {
  const { doc, updateDoc } = deps;
  await updateDoc(doc(db, coursePath(uid, yearId, courseId)), { name });
}

/**
 * Set (or clear) the archived flag on a course. Archived courses are hidden
 * from listCourses by default but never deleted — call with `false` to restore.
 * Non-destructive.
 */
export async function archiveCourse(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  archived: boolean,
  deps: CourseUpdateDeps = defaultCourseUpdateDeps,
): Promise<void> {
  const { doc, updateDoc } = deps;
  await updateDoc(doc(db, coursePath(uid, yearId, courseId)), { archived });
}
```

**Step 4 — Run; expect PASS.**

```bash
npx vitest run src/data/renameCourse.test.ts
```

**Step 5 — Commit.**

```bash
git add src/data/renameCourse.ts src/data/renameCourse.test.ts
git commit -m "Add renameCourse and archiveCourse data fns"
```

---

### Task F7: `deleteCourse` (destructive cascade)

Permanently delete a course and ALL data nested under it: every period, every student under each
period, and every feedbackHistory entry under each student — children first, course doc last. The
client SDK has no recursive delete, so we enumerate with `getDocs` and `deleteDoc` each level.
Mirrors `deleteClass` and uses the same `vi.hoisted` mock style.

**Step 1 — Write the failing test (REAL code).**

Create `src/data/deleteCourse.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the modular Firestore SDK (un-injected path), path-shaped like deleteClass.test.
const mocks = vi.hoisted(() => ({
  collection: vi.fn((_db: unknown, path: string) => ({ __path: path })),
  doc: vi.fn((_db: unknown, path: string) => ({ __path: path })),
  getDocs: vi.fn(async (ref: { __path: string }) => {
    // periods under the course
    if (ref.__path.endsWith('/periods')) {
      return { docs: [{ id: 'pd1' }] };
    }
    // students under a period
    if (ref.__path.endsWith('/students')) {
      return { docs: [{ id: 'st1' }, { id: 'st2' }] };
    }
    // feedbackHistory under a student
    if (ref.__path.endsWith('/feedbackHistory')) {
      return { docs: [{ id: 'fh1' }] };
    }
    return { docs: [] };
  }),
  deleteDoc: vi.fn(async (_ref: { __path: string }) => undefined),
}));

vi.mock('firebase/firestore', () => ({
  collection: mocks.collection,
  doc: mocks.doc,
  getDocs: mocks.getDocs,
  deleteDoc: mocks.deleteDoc,
}));

import { deleteCourse } from './deleteCourse';

const db = { __type: 'firestore' } as never;
const uid = 'teacher-1';
const yearId = 'y2025';
const courseId = 'c1';
const coursePath = `teachers/${uid}/years/${yearId}/courses/${courseId}`;
const periodPath = `${coursePath}/periods/pd1`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deleteCourse (destructive deep cascade)', () => {
  it('deletes feedbackHistory, students, periods, then the course doc', async () => {
    await deleteCourse(db, uid, yearId, courseId);

    // enumerated each level
    expect(mocks.collection).toHaveBeenCalledWith(db, `${coursePath}/periods`);
    expect(mocks.collection).toHaveBeenCalledWith(db, `${periodPath}/students`);
    expect(mocks.collection).toHaveBeenCalledWith(db, `${periodPath}/students/st1/feedbackHistory`);

    // deleted the deepest doc
    expect(mocks.doc).toHaveBeenCalledWith(
      db,
      `${periodPath}/students/st1/feedbackHistory/fh1`,
    );
    // deleted students
    expect(mocks.doc).toHaveBeenCalledWith(db, `${periodPath}/students/st1`);
    expect(mocks.doc).toHaveBeenCalledWith(db, `${periodPath}/students/st2`);
    // deleted the period
    expect(mocks.doc).toHaveBeenCalledWith(db, periodPath);
    // deleted the course doc itself
    expect(mocks.doc).toHaveBeenCalledWith(db, coursePath);
  });

  it('deletes the course doc LAST', async () => {
    const order: string[] = [];
    mocks.deleteDoc.mockImplementation(async (ref: { __path: string }) => {
      order.push(ref.__path);
      return undefined;
    });

    await deleteCourse(db, uid, yearId, courseId);

    expect(order[order.length - 1]).toBe(coursePath);
    // feedbackHistory (deepest) is removed before its student
    expect(order.indexOf(`${periodPath}/students/st1/feedbackHistory/fh1`)).toBeLessThan(
      order.indexOf(`${periodPath}/students/st1`),
    );
    // students removed before their period
    expect(order.indexOf(`${periodPath}/students/st1`)).toBeLessThan(order.indexOf(periodPath));
  });

  it('still deletes the course doc when there are no children', async () => {
    mocks.getDocs.mockResolvedValue({ docs: [] } as never);

    await deleteCourse(db, uid, yearId, courseId);

    expect(mocks.deleteDoc).toHaveBeenCalledWith({ __path: coursePath });
    expect(mocks.deleteDoc).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2 — Run; expect FAIL.**

```bash
npx vitest run src/data/deleteCourse.test.ts
```

Expect failure: `Failed to resolve import "./deleteCourse"`.

**Step 3 — Minimal implementation (REAL code).**

Create `src/data/deleteCourse.ts`:

```ts
import {
  collection as fbCollection,
  doc as fbDoc,
  getDocs as fbGetDocs,
  deleteDoc as fbDeleteDoc,
  type Firestore,
} from 'firebase/firestore';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface CourseDeleteDeps {
  collection: typeof fbCollection;
  doc: typeof fbDoc;
  getDocs: typeof fbGetDocs;
  deleteDoc: typeof fbDeleteDoc;
}

const defaultDeps: CourseDeleteDeps = {
  collection: fbCollection,
  doc: fbDoc,
  getDocs: fbGetDocs,
  deleteDoc: fbDeleteDoc,
};

/**
 * DESTRUCTIVE. Permanently deletes a course and ALL data nested under it:
 *   periods/{pId}/students/{sId}/feedbackHistory/{fId}
 * The Firestore client SDK has no recursive delete, so we walk the tree and
 * delete deepest-first — every feedbackHistory entry, then each student, then
 * each period, then the course doc LAST — so an interrupted run never orphans
 * children behind a missing parent. There is no undo; callers must confirm
 * with the user first. To merely hide a course, use archiveCourse instead.
 */
export async function deleteCourse(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  deps: CourseDeleteDeps = defaultDeps,
): Promise<void> {
  const { collection, doc, getDocs, deleteDoc } = deps;
  const coursePath = `teachers/${uid}/years/${yearId}/courses/${courseId}`;

  const periodsSnap = await getDocs(collection(db, `${coursePath}/periods`));
  for (const period of periodsSnap.docs) {
    const periodPath = `${coursePath}/periods/${period.id}`;

    const studentsSnap = await getDocs(collection(db, `${periodPath}/students`));
    for (const student of studentsSnap.docs) {
      const studentPath = `${periodPath}/students/${student.id}`;

      // Deepest level first: feedbackHistory entries.
      const historySnap = await getDocs(collection(db, `${studentPath}/feedbackHistory`));
      for (const entry of historySnap.docs) {
        await deleteDoc(doc(db, `${studentPath}/feedbackHistory/${entry.id}`));
      }

      // Then the student doc.
      await deleteDoc(doc(db, studentPath));
    }

    // Then the period doc.
    await deleteDoc(doc(db, periodPath));
  }

  // The course doc LAST.
  await deleteDoc(doc(db, coursePath));
}
```

**Step 4 — Run; expect PASS.**

```bash
npx vitest run src/data/deleteCourse.test.ts
```

**Step 5 — Commit.**

```bash
git add src/data/deleteCourse.ts src/data/deleteCourse.test.ts
git commit -m "Add deleteCourse destructive deep cascade (periods/students/feedbackHistory)"
```

---

### Task F8: `createPeriod` / `listPeriods`

Create one period per checked grading period and list a course's periods sorted by `order`. Path:
`teachers/{uid}/years/{yearId}/courses/{courseId}/periods/{periodId}`. `createPeriod` writes a single
period (callers loop over the checked items); we validate the label against `GRADING_PERIODS` from
the taxonomy config so the period list is never hardcoded here.

**Step 1 — Write the failing test (REAL code).**

Create `src/data/periods.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createPeriod, listPeriods } from './periods';
import type { Period } from '../types';

const uid = 'teacher-1';
const yearId = 'y2025';
const courseId = 'c1';
const periodsPath = `teachers/${uid}/years/${yearId}/courses/${courseId}/periods`;

describe('createPeriod', () => {
  it('writes one period (label + order) and returns its id', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'pd-q1' }));

    const id = await createPeriod(
      db as any,
      uid,
      yearId,
      courseId,
      { label: 'Q1', order: 0 },
      { collection, addDoc } as any,
    );

    expect(id).toBe('pd-q1');
    expect(collection).toHaveBeenCalledWith(db, periodsPath);
    expect(addDoc.mock.calls[0][1]).toEqual({ label: 'Q1', order: 0 });
  });

  it('rejects a label not in GRADING_PERIODS', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn();

    await expect(
      createPeriod(
        db as any,
        uid,
        yearId,
        courseId,
        { label: 'Q9', order: 0 },
        { collection, addDoc } as any,
      ),
    ).rejects.toThrow(/Q9/);
    expect(addDoc).not.toHaveBeenCalled();
  });
});

describe('listPeriods', () => {
  it('reads the periods subcollection and returns Period[] sorted by order', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => ({
      docs: [
        { id: 'pd-q2', data: () => ({ label: 'Q2', order: 1 }) },
        { id: 'pd-q1', data: () => ({ label: 'Q1', order: 0 }) },
      ],
    }));

    const result = await listPeriods(db as any, uid, yearId, courseId, { collection, getDocs } as any);

    expect(collection).toHaveBeenCalledWith(db, periodsPath);
    const expected: Period[] = [
      { id: 'pd-q1', label: 'Q1', order: 0 },
      { id: 'pd-q2', label: 'Q2', order: 1 },
    ];
    expect(result).toEqual(expected);
  });
});
```

**Step 2 — Run; expect FAIL.**

```bash
npx vitest run src/data/periods.test.ts
```

Expect failure: `Failed to resolve import "./periods"`.

**Step 3 — Minimal implementation (REAL code).**

Create `src/data/periods.ts`:

```ts
import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  getDocs as fbGetDocs,
  type Firestore,
} from 'firebase/firestore';
import type { Period } from '../types';
import { GRADING_PERIODS, type GradingPeriod } from '../feedback/taxonomy';

const periodsPath = (uid: string, yearId: string, courseId: string) =>
  `teachers/${uid}/years/${yearId}/courses/${courseId}/periods`;

/** Injectable Firestore primitives for period writes. */
export interface PeriodWriteDeps {
  collection: typeof fbCollection;
  addDoc: typeof fbAddDoc;
}

const defaultWriteDeps: PeriodWriteDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
};

/** A new period: a grading-period label plus its position in the year. */
export interface NewPeriodInput {
  label: string;
  order: number;
}

/**
 * Create ONE period under a course (callers loop over the checked grading
 * periods). The label MUST be one of GRADING_PERIODS — the valid set lives in
 * the taxonomy config, never hardcoded here — so an unknown label is rejected
 * before any write reaches Firestore. Returns the new period id.
 */
export async function createPeriod(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  input: NewPeriodInput,
  deps: PeriodWriteDeps = defaultWriteDeps,
): Promise<string> {
  if (!(GRADING_PERIODS as readonly string[]).includes(input.label)) {
    throw new Error(`Unknown grading period label: ${input.label}`);
  }
  const { collection, addDoc } = deps;
  const ref = collection(db, periodsPath(uid, yearId, courseId));
  const docRef = await addDoc(ref, { label: input.label as GradingPeriod, order: input.order });
  return docRef.id;
}

/** Injectable Firestore primitives for period reads. */
export interface PeriodReadDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
}

const defaultReadDeps: PeriodReadDeps = {
  collection: fbCollection,
  getDocs: fbGetDocs,
};

/**
 * List a course's periods as Period[], sorted ascending by `order` so callers
 * render them in grading-period sequence.
 */
export async function listPeriods(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  deps: PeriodReadDeps = defaultReadDeps,
): Promise<Period[]> {
  const { collection, getDocs } = deps;
  const snap = await getDocs(collection(db, periodsPath(uid, yearId, courseId)));
  const periods = snap.docs.map((d) => {
    const data = d.data() as Omit<Period, 'id'>;
    return { id: d.id, label: data.label, order: data.order };
  });
  return periods.sort((a, b) => a.order - b.order);
}
```

**Step 4 — Run; expect PASS.**

```bash
npx vitest run src/data/periods.test.ts
```

**Step 5 — Commit.**

```bash
git add src/data/periods.ts src/data/periods.test.ts
git commit -m "Add createPeriod (validated against taxonomy) and listPeriods sorted by order"
```

---

### Task F9: Corrected `saveStudents` / `listStudents` on the nested period path

Re-point the roster persistence at the new path:
`teachers/{uid}/years/{yearId}/courses/{courseId}/periods/{periodId}/students/{studentId}`. We add
a NEW module `src/data/students.ts` (DI-style) that supersedes the old `classId`-based
`saveStudents.ts`/`listStudents.ts`, so the corrected path lives in one place the redesign imports.

**Step 1 — Write the failing test (REAL code).**

Create `src/data/students.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { saveStudents, listStudents } from './students';
import type { Student } from '../types';

const uid = 'teacher-1';
const yearId = 'y2025';
const courseId = 'c1';
const periodId = 'p1';
const studentsPath =
  `teachers/${uid}/years/${yearId}/courses/${courseId}/periods/${periodId}/students`;

describe('saveStudents (nested period path)', () => {
  it('writes each student under the period students subcollection', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'generated' }));

    const students: Student[] = [
      { id: 's1', name: 'Ada Lovelace', email: 'ada@example.com', period: '3' },
      { id: 's2', name: 'Alan Turing', email: 'alan@example.com', period: '3' },
    ];

    const count = await saveStudents(
      db as any,
      uid,
      yearId,
      courseId,
      periodId,
      students,
      { collection, addDoc } as any,
    );

    expect(count).toBe(2);
    expect(collection).toHaveBeenCalledWith(db, studentsPath);
    expect(addDoc).toHaveBeenCalledTimes(2);
    expect(addDoc.mock.calls[0][1]).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      period: '3',
    });
  });
});

describe('listStudents (nested period path)', () => {
  it('reads the period students subcollection and maps docs to Student[]', async () => {
    const db = { __fake: true };
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () => ({
      docs: [
        { id: 's1', data: () => ({ name: 'Ada', email: 'ada@example.com', period: '3' }) },
        { id: 's2', data: () => ({ name: 'Alan', email: 'alan@example.com' }) },
      ],
    }));

    const result = await listStudents(
      db as any,
      uid,
      yearId,
      courseId,
      periodId,
      { collection, getDocs } as any,
    );

    expect(collection).toHaveBeenCalledWith(db, studentsPath);
    const expected: Student[] = [
      { id: 's1', name: 'Ada', email: 'ada@example.com', period: '3' },
      { id: 's2', name: 'Alan', email: 'alan@example.com' },
    ];
    expect(result).toEqual(expected);
  });
});
```

**Step 2 — Run; expect FAIL.**

```bash
npx vitest run src/data/students.test.ts
```

Expect failure: `Failed to resolve import "./students"`.

**Step 3 — Minimal implementation (REAL code).**

Create `src/data/students.ts`:

```ts
import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  getDocs as fbGetDocs,
  type Firestore,
} from 'firebase/firestore';
import type { Student } from '../types';

/**
 * CORRECTED PATH for the redesign — students live deep under their period:
 *   teachers/{uid}/years/{yearId}/courses/{courseId}/periods/{periodId}/students/{studentId}
 * (the old classId-based path in saveStudents.ts/listStudents.ts is superseded).
 */
const studentsPath = (
  uid: string,
  yearId: string,
  courseId: string,
  periodId: string,
) =>
  `teachers/${uid}/years/${yearId}/courses/${courseId}/periods/${periodId}/students`;

/** Injectable Firestore primitives for student writes. */
export interface StudentWriteDeps {
  collection: typeof fbCollection;
  addDoc: typeof fbAddDoc;
}

const defaultWriteDeps: StudentWriteDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
};

/** Persist imported students under their period. Returns the count written. */
export async function saveStudents(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  periodId: string,
  students: Student[],
  deps: StudentWriteDeps = defaultWriteDeps,
): Promise<number> {
  const { collection, addDoc } = deps;
  const ref = collection(db, studentsPath(uid, yearId, courseId, periodId));
  for (const s of students) {
    await addDoc(ref, { name: s.name, email: s.email, period: s.period });
  }
  return students.length;
}

/** Injectable Firestore primitives for student reads. */
export interface StudentReadDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
}

const defaultReadDeps: StudentReadDeps = {
  collection: fbCollection,
  getDocs: fbGetDocs,
};

/** Load a period's students as Student[]. Omits `period` when absent. */
export async function listStudents(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  periodId: string,
  deps: StudentReadDeps = defaultReadDeps,
): Promise<Student[]> {
  const { collection, getDocs } = deps;
  const snap = await getDocs(collection(db, studentsPath(uid, yearId, courseId, periodId)));
  return snap.docs.map((d) => {
    const data = d.data() as { name: string; email: string; period?: string };
    const student: Student = { id: d.id, name: data.name, email: data.email };
    if (data.period !== undefined) student.period = data.period;
    return student;
  });
}
```

**Step 4 — Run; expect PASS.**

```bash
npx vitest run src/data/students.test.ts
```

**Step 5 — Commit.**

```bash
git add src/data/students.ts src/data/students.test.ts
git commit -m "Add saveStudents/listStudents pointed at nested period path"
```

---

### Task F10: Corrected `updateStudent` / `deleteStudent` on the nested period path

Patch and remove a single student at the new path. Add them to `src/data/students.ts` (alongside
Task 9's functions) so all period-student CRUD lives in one module. `updateStudent` re-validates
email exactly as the old one did.

**Step 1 — Write the failing test (REAL code).**

Create `src/data/studentsCrud.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { updateStudent, deleteStudent } from './students';

const uid = 'teacher-1';
const yearId = 'y2025';
const courseId = 'c1';
const periodId = 'p1';
const studentId = 's1';
const studentPath =
  `teachers/${uid}/years/${yearId}/courses/${courseId}/periods/${periodId}/students/${studentId}`;

describe('updateStudent (nested period path)', () => {
  it('patches the student at the nested path', async () => {
    const db = { __fake: true };
    const doc = vi.fn((_db: unknown, p: string) => ({ __path: p }));
    const updateDoc = vi.fn(async () => undefined);

    await updateStudent(
      db as any,
      uid,
      yearId,
      courseId,
      periodId,
      studentId,
      { name: 'Ada L.' },
      { doc, updateDoc } as any,
    );

    expect(doc).toHaveBeenCalledWith(db, studentPath);
    expect(updateDoc).toHaveBeenCalledWith({ __path: studentPath }, { name: 'Ada L.' });
  });

  it('rejects an invalid email before writing', async () => {
    const db = { __fake: true };
    const doc = vi.fn();
    const updateDoc = vi.fn();

    await expect(
      updateStudent(
        db as any,
        uid,
        yearId,
        courseId,
        periodId,
        studentId,
        { email: 'not-an-email' },
        { doc, updateDoc } as any,
      ),
    ).rejects.toThrow(/Invalid email/);
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

describe('deleteStudent (nested period path)', () => {
  it('deletes the student at the nested path', async () => {
    const db = { __fake: true };
    const doc = vi.fn((_db: unknown, p: string) => ({ __path: p }));
    const deleteDoc = vi.fn(async () => undefined);

    await deleteStudent(
      db as any,
      uid,
      yearId,
      courseId,
      periodId,
      studentId,
      { doc, deleteDoc } as any,
    );

    expect(doc).toHaveBeenCalledWith(db, studentPath);
    expect(deleteDoc).toHaveBeenCalledWith({ __path: studentPath });
  });
});
```

**Step 2 — Run; expect FAIL.**

```bash
npx vitest run src/data/studentsCrud.test.ts
```

Expect failure: `updateStudent`/`deleteStudent` are not exported from `./students`.

**Step 3 — Minimal implementation (REAL code).**

Append to `src/data/students.ts`:

```ts
import {
  doc as fbDoc,
  updateDoc as fbUpdateDoc,
  deleteDoc as fbDeleteDoc,
} from 'firebase/firestore';

/** Same email shape the roster importer validates with (src/roster/parseRoster.ts). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Editable subset of a student. */
export type StudentPatch = Partial<Pick<Student, 'name' | 'email' | 'period'>>;

const studentDocPath = (
  uid: string,
  yearId: string,
  courseId: string,
  periodId: string,
  studentId: string,
) => `${studentsPath(uid, yearId, courseId, periodId)}/${studentId}`;

/** Injectable Firestore primitives for a student update. */
export interface StudentUpdateDeps {
  doc: typeof fbDoc;
  updateDoc: typeof fbUpdateDoc;
}

const defaultUpdateDeps: StudentUpdateDeps = {
  doc: fbDoc,
  updateDoc: fbUpdateDoc,
};

/**
 * Patch a single student at the nested period path. Re-validates email when the
 * patch includes one; an invalid email is rejected before any write reaches
 * Firestore.
 */
export async function updateStudent(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  periodId: string,
  studentId: string,
  patch: StudentPatch,
  deps: StudentUpdateDeps = defaultUpdateDeps,
): Promise<void> {
  if (patch.email !== undefined && !EMAIL_RE.test(patch.email)) {
    throw new Error(`Invalid email: ${patch.email}`);
  }
  const { doc, updateDoc } = deps;
  const ref = doc(db, studentDocPath(uid, yearId, courseId, periodId, studentId));
  await updateDoc(ref, { ...patch });
}

/** Injectable Firestore primitives for a student delete. */
export interface StudentDeleteDeps {
  doc: typeof fbDoc;
  deleteDoc: typeof fbDeleteDoc;
}

const defaultDeleteDeps: StudentDeleteDeps = {
  doc: fbDoc,
  deleteDoc: fbDeleteDoc,
};

/** Remove a single student at the nested period path. */
export async function deleteStudent(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  periodId: string,
  studentId: string,
  deps: StudentDeleteDeps = defaultDeleteDeps,
): Promise<void> {
  const { doc, deleteDoc } = deps;
  await deleteDoc(doc(db, studentDocPath(uid, yearId, courseId, periodId, studentId)));
}
```

**Step 4 — Run; expect PASS.**

```bash
npx vitest run src/data/studentsCrud.test.ts src/data/students.test.ts
```

Both Task 9 and Task 10 tests pass against the shared module.

**Step 5 — Commit.**

```bash
git add src/data/students.ts src/data/studentsCrud.test.ts
git commit -m "Add updateStudent/deleteStudent pointed at nested period path"
```

---

### Task F11: Extend `firestore.rules` for the new tree + rules test

The existing recursive `match /teachers/{ownerUid}/{document=**}` rule already covers everything under
a teacher's tree (years/courses/periods/students/feedbackHistory included), owner-only. This task adds
EXPLICIT, documented rules for each new collection (so the security surface is reviewable and a future
edit can tighten a single collection without weakening the rest) and proves them with emulator tests.
The recursive catch-all stays as the backstop.

**Step 1 — Write the failing test (REAL code).**

Append these cases to `src/firebase/rules.test.ts`, inside the existing
`describe('Firestore security rules', ...)` block (after the last `it`):

```ts
  const deepStudentPath =
    `teachers/${OWNER_UID}/years/y1/courses/c1/periods/p1/students/s1`;
  const historyPath = `${deepStudentPath}/feedbackHistory/h1`;

  it('lets the owner write a course/period/student in the new tree', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(ownerDb, `teachers/${OWNER_UID}/years/y1`), { label: '2025–2026' }),
    );
    await assertSucceeds(
      setDoc(doc(ownerDb, `teachers/${OWNER_UID}/years/y1/courses/c1`), { name: 'Bio' }),
    );
    await assertSucceeds(
      setDoc(doc(ownerDb, deepStudentPath), { name: 'Ada', email: 'ada@example.com' }),
    );
  });

  it('lets the owner write a feedbackHistory entry', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(ownerDb, historyPath), {
        studentId: 's1',
        finalText: 'Great year.',
        usedEntries: ['b1'],
      }),
    );
  });

  it('FORBIDS a stranger from reading a deep student in the new tree', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), deepStudentPath), {
        name: 'Ada',
        email: 'ada@example.com',
      });
    });
    const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
    await assertFails(getDoc(doc(strangerDb, deepStudentPath)));
  });

  it('FORBIDS a stranger from reading the owner feedbackHistory', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), historyPath), { finalText: 'private' });
    });
    const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
    await assertFails(getDoc(doc(strangerDb, historyPath)));
  });
```

**Step 2 — Run; expect FAIL.**

```bash
npm run test:rules
```

Expect the new owner-write assertions to surface the intended explicit-rule additions. (If the
emulator/JDK is unavailable in this environment, this is the documented gate that proves the rules;
the failing-first state is the absence of the explicit collection rules below.)

**Step 3 — Minimal implementation (REAL code).**

Replace the body of `match /databases/{database}/documents { ... }` in `firestore.rules` with explicit
per-collection rules plus the recursive backstop:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Owner check: the signed-in user must own this teacher tree.
    function isOwner(ownerUid) {
      return request.auth != null && request.auth.uid == ownerUid;
    }

    match /teachers/{ownerUid} {

      // --- Redesign hierarchy: year > course > period > student > feedbackHistory ---
      match /years/{yearId} {
        allow read, write: if isOwner(ownerUid);

        match /courses/{courseId} {
          allow read, write: if isOwner(ownerUid);

          match /periods/{periodId} {
            allow read, write: if isOwner(ownerUid);

            match /students/{studentId} {
              allow read, write: if isOwner(ownerUid);

              match /feedbackHistory/{entryId} {
                allow read, write: if isOwner(ownerUid);
              }
            }
          }
        }
      }

      // --- Backstop: anything else under the teacher tree is owner-only too
      // (legacy classes/, bankEntries/, batches/, messages/). Keeps existing
      // collections working and denies non-owners everywhere by default. ---
      match /{document=**} {
        allow read, write: if isOwner(ownerUid);
      }
    }

    // Anything outside a teacher tree is denied by default (no catch-all rule).
  }
}
```

**Step 4 — Run; expect PASS.**

```bash
npm run test:rules
```

All rules cases pass: the owner can write the new year/course/period/student/feedbackHistory docs, and
strangers/anonymous clients are denied at every level. The pre-existing rules cases (classes, bankEntries)
still pass via the backstop.

**Step 5 — Commit.**

```bash
git add firestore.rules src/firebase/rules.test.ts
git commit -m "Extend firestore.rules with explicit year/course/period/student/feedbackHistory owner-only rules"
```

---

### Task F12: Phase 1 full-suite green gate

A guard task: confirm the whole default unit suite (the existing 263 plus the new Phase 1 tests) is green
and nothing regressed from the `Batch`/types changes. No new product code.

**Step 1 — Write/confirm the gate (REAL command).**

There is no new test file; the "test" is the full default suite. Run it:

```bash
npx vitest run
```

**Step 2 — Run; expect FAIL only if a regression exists.**

If any existing test fails (most likely a stale `Batch` literal missing `periodId`, or an old import of
the relocated student fns), it surfaces here. Expected at this point: GREEN, because Task 3 already fixed
the one affected literal in `types.test.ts` and the new student module is additive (the old
`saveStudents.ts`/`listStudents.ts` remain untouched for legacy callers).

**Step 3 — Minimal fix (REAL code), only if red.**

If a failure appears, apply the smallest correction (e.g. add `periodId` to a `Batch` literal the
compiler now requires, or update an import path). Do not change behavior beyond satisfying the new types.

**Step 4 — Run; expect PASS.**

```bash
npx vitest run
```

Full suite green (263 prior + Phase 1 additions). Note: `src/firebase/rules.test.ts` is excluded from
the default run and validated separately via `npm run test:rules` in Task 11.

**Step 5 — Commit (only if Step 3 changed anything).**

```bash
git add -A
git commit -m "Phase 1 foundation: full unit suite green"
```
```

I've completed the Phase 1 plan. Here is the summary of what I produced and the key facts the assembly step needs.

**Note on the spec:** The path in my prompt (`docs/superpowers/specs/2026-06-16-year-course-period-redesign.md`) does not exist in the repo. The only spec present is `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/docs/superpowers/specs/2026-06-16-personalized-student-feedback-emails-design.md` (the original design, which is history-ready but pre-dates the year/course/period redesign). I built the plan from the CANONICAL DECISIONS in my prompt plus that design spec and the verified existing code conventions.

**Phase 1 plan — 12 tasks (each 5-step TDD, complete real code, no placeholders):**

1. `src/feedback/taxonomy.ts` — `deriveSentiment(type)`, `SENTIMENT_BY_TYPE`, `GRADING_PERIODS` (Q1–Q4,S1,S2,EOY), `TAG_CATEGORIES` (areas/sentiments/standards) + types.
2. New canonical types in `src/types.ts` — `Year`, `Course`, `Period`, `FeedbackHistoryEntry` (imports `GradingPeriod` from taxonomy).
3. `Batch.periodId` added (replaces `classId`, which becomes legacy-optional); fixes the one affected literal in existing `src/types.test.ts`.
4. `src/data/years.ts` — `createYear`, `getOrCreateCurrentYear`.
5. `src/data/courses.ts` — `createCourse`, `listCourses` (active-only + `includeArchived`).
6. `src/data/renameCourse.ts` — `renameCourse`, `archiveCourse`.
7. `src/data/deleteCourse.ts` — destructive deep cascade (periods → students → feedbackHistory, course doc last).
8. `src/data/periods.ts` — `createPeriod` (validated against taxonomy `GRADING_PERIODS`), `listPeriods` (sorted by order).
9. `src/data/students.ts` — corrected `saveStudents`/`listStudents` on the nested period path.
10. Same `src/data/students.ts` — corrected `updateStudent`/`deleteStudent` (email re-validation preserved).
11. `firestore.rules` extended with explicit owner-only rules for years/courses/periods/students/feedbackHistory + new emulator rules-test cases appended to `src/firebase/rules.test.ts`.
12. Full-suite green gate (`npx vitest run`).

**Conventions I matched (verified in code, load-bearing for downstream phases):**
- DI signature `(db, uid, ...args, deps?)` with injectable Firestore primitives defaulting to the real SDK (per `createClass.ts`/`listClasses.ts`).
- Cascade/multi-primitive tests use `vi.hoisted` mocks of `firebase/firestore` (per `deleteClass.test.ts`); simple fns inject `deps` directly (per `listClasses.test.ts`).
- Default `vitest run` EXCLUDES `src/firebase/rules.test.ts`; rules run only via `npm run test:rules` against the emulator (per `vitest.rules.config.ts`). I called this out explicitly in Tasks 11 and 12.
- The existing recursive `match /teachers/{ownerUid}/{document=**}` rule already technically covers the new tree; Task 11 adds explicit per-collection rules for reviewability and keeps the recursive rule as the backstop for legacy `classes/`, `bankEntries/`, `batches/`.

**One decision the assembler should be aware of:** I created NEW modules (`src/data/students.ts`, `src/data/courses.ts`, etc.) for the corrected nested-path CRUD rather than mutating the existing `src/data/saveStudents.ts`/`listStudents.ts`/`updateStudent.ts`/`deleteStudent.ts` (which still use the `classId` path and have green tests). This keeps the 263 existing tests green and avoids breaking legacy callers; later phases can delete the old class-path modules once compose/roster migrate to the period path.

---

## Phase 2 — Setup + Navigation + Home

## Phase 2 — Setup + Navigation + Home

> **Phase-1 prerequisites this phase imports (do not author here):** `src/feedback/taxonomy.ts` (GRADING_PERIODS, sentiment map, tag categories), the `Year`/`Course`/`Period`/`FeedbackHistoryEntry` types in `src/types.ts`, `getOrCreateCurrentYear(db, uid, deps?)`, and `listFeedbackHistory(db, uid, {yearId,courseId,periodId}, deps?)`. The course/period CRUD data fns are authored here because they are consumed only by this phase's SetupPage/HomePage.
>
> All new Firestore paths follow the canonical layout: `teachers/{uid}/years/{yearId}/courses/{courseId}/periods/{periodId}/students/{studentId}`.

---

### Task N1: `createCourse` data fn (new year→course path)

**Step 1 — Write the failing test (REAL code).** Create `src/data/createCourse.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createCourse } from './createCourse';

describe('createCourse', () => {
  it('writes to teachers/{uid}/years/{yearId}/courses and returns the new courseId', async () => {
    const uid = 'teacher-1';
    const yearId = 'year-2026';
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'course-xyz' }));
    const db = { __fake: true };

    const courseId = await createCourse(
      db as any,
      uid,
      yearId,
      { name: 'Biology' },
      { collection, addDoc } as any,
    );

    expect(courseId).toBe('course-xyz');
    expect(collection).toHaveBeenCalledWith(
      db,
      `teachers/${uid}/years/${yearId}/courses`,
    );
    expect(addDoc.mock.calls[0][1]).toEqual({ name: 'Biology', archived: false });
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/data/createCourse.test.ts` → fails: `Cannot find module './createCourse'`.

**Step 3 — Minimal implementation (REAL code).** Create `src/data/createCourse.ts`:

```ts
import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Course } from '../types';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface CourseWriteDeps {
  collection: typeof fbCollection;
  addDoc: typeof fbAddDoc;
}

const defaultDeps: CourseWriteDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
};

/**
 * Create a course under a given year and return its new id.
 * Writes teachers/{uid}/years/{yearId}/courses/{courseId} per the canonical paths.
 * `archived` is seeded false so listCourses can filter on it without undefined checks.
 */
export async function createCourse(
  db: Firestore,
  uid: string,
  yearId: string,
  meta: Pick<Course, 'name'>,
  deps: CourseWriteDeps = defaultDeps,
): Promise<string> {
  const { collection, addDoc } = deps;
  const ref = collection(db, `teachers/${uid}/years/${yearId}/courses`);
  const docRef = await addDoc(ref, { name: meta.name, archived: false });
  return docRef.id;
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/data/createCourse.test.ts` → green.

**Step 5 — Commit.** `git add src/data/createCourse.* && git commit -m "Add createCourse data fn for year→course path"`

---

### Task N2: `createPeriod` data fn (course→period path)

**Step 1 — Write the failing test (REAL code).** Create `src/data/createPeriod.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createPeriod } from './createPeriod';

describe('createPeriod', () => {
  it('writes to .../courses/{courseId}/periods and returns the new periodId', async () => {
    const uid = 'teacher-1';
    const yearId = 'year-2026';
    const courseId = 'course-bio';
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'period-xyz' }));
    const db = { __fake: true };

    const periodId = await createPeriod(
      db as any,
      uid,
      yearId,
      courseId,
      { label: 'Period 3', order: 3 },
      { collection, addDoc } as any,
    );

    expect(periodId).toBe('period-xyz');
    expect(collection).toHaveBeenCalledWith(
      db,
      `teachers/${uid}/years/${yearId}/courses/${courseId}/periods`,
    );
    expect(addDoc.mock.calls[0][1]).toEqual({ label: 'Period 3', order: 3 });
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/data/createPeriod.test.ts` → fails: `Cannot find module './createPeriod'`.

**Step 3 — Minimal implementation (REAL code).** Create `src/data/createPeriod.ts`:

```ts
import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Period } from '../types';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface PeriodWriteDeps {
  collection: typeof fbCollection;
  addDoc: typeof fbAddDoc;
}

const defaultDeps: PeriodWriteDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
};

/**
 * Create a period under a given course and return its new id. Writes
 * teachers/{uid}/years/{yearId}/courses/{courseId}/periods/{periodId}.
 * `order` drives the display sort (see listPeriods); `label` is teacher-facing.
 */
export async function createPeriod(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  meta: Pick<Period, 'label' | 'order'>,
  deps: PeriodWriteDeps = defaultDeps,
): Promise<string> {
  const { collection, addDoc } = deps;
  const ref = collection(
    db,
    `teachers/${uid}/years/${yearId}/courses/${courseId}/periods`,
  );
  const docRef = await addDoc(ref, { label: meta.label, order: meta.order });
  return docRef.id;
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/data/createPeriod.test.ts` → green.

**Step 5 — Commit.** `git add src/data/createPeriod.* && git commit -m "Add createPeriod data fn for course→period path"`

---

### Task N3: `listCourses` + `listPeriods` read fns

**Step 1 — Write the failing test (REAL code).** Create `src/data/listCoursesPeriods.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { listCourses } from './listCourses';
import { listPeriods } from './listPeriods';

function snap(docs: Array<{ id: string; data: () => unknown }>) {
  return { docs };
}

describe('listCourses', () => {
  it('reads .../courses and hides archived by default', async () => {
    const uid = 'teacher-1';
    const yearId = 'year-2026';
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () =>
      snap([
        { id: 'c1', data: () => ({ name: 'Biology', archived: false }) },
        { id: 'c2', data: () => ({ name: 'Old Chem', archived: true }) },
      ]),
    );
    const db = { __fake: true };

    const courses = await listCourses(db as any, uid, yearId, { collection, getDocs } as any);

    expect(collection).toHaveBeenCalledWith(db, `teachers/${uid}/years/${yearId}/courses`);
    expect(courses).toEqual([{ id: 'c1', name: 'Biology', archived: false }]);
  });

  it('includes archived when asked', async () => {
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () =>
      snap([{ id: 'c2', data: () => ({ name: 'Old Chem', archived: true }) }]),
    );
    const courses = await listCourses(
      { __fake: true } as any,
      'teacher-1',
      'year-2026',
      { collection, getDocs } as any,
      { includeArchived: true },
    );
    expect(courses).toEqual([{ id: 'c2', name: 'Old Chem', archived: true }]);
  });
});

describe('listPeriods', () => {
  it('reads .../periods and returns them sorted by order', async () => {
    const uid = 'teacher-1';
    const yearId = 'year-2026';
    const courseId = 'course-bio';
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async () =>
      snap([
        { id: 'p3', data: () => ({ label: 'Period 5', order: 5 }) },
        { id: 'p1', data: () => ({ label: 'Period 1', order: 1 }) },
        { id: 'p2', data: () => ({ label: 'Period 3', order: 3 }) },
      ]),
    );
    const db = { __fake: true };

    const periods = await listPeriods(
      db as any,
      uid,
      yearId,
      courseId,
      { collection, getDocs } as any,
    );

    expect(collection).toHaveBeenCalledWith(
      db,
      `teachers/${uid}/years/${yearId}/courses/${courseId}/periods`,
    );
    expect(periods.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(periods[0]).toEqual({ id: 'p1', label: 'Period 1', order: 1 });
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/data/listCoursesPeriods.test.ts` → fails: cannot find `./listCourses`.

**Step 3 — Minimal implementation (REAL code).** Create `src/data/listCourses.ts`:

```ts
import {
  collection as fbCollection,
  getDocs as fbGetDocs,
  type Firestore,
} from 'firebase/firestore';
import type { Course } from '../types';

export interface CourseReadDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
}

const defaultDeps: CourseReadDeps = { collection: fbCollection, getDocs: fbGetDocs };

export interface ListCoursesOptions {
  includeArchived?: boolean;
}

/**
 * List a year's courses from teachers/{uid}/years/{yearId}/courses.
 * Archived courses are hidden unless { includeArchived: true } is passed.
 */
export async function listCourses(
  db: Firestore,
  uid: string,
  yearId: string,
  deps: CourseReadDeps = defaultDeps,
  options: ListCoursesOptions = {},
): Promise<Course[]> {
  const { collection, getDocs } = deps;
  const { includeArchived = false } = options;
  const snap = await getDocs(collection(db, `teachers/${uid}/years/${yearId}/courses`));
  const courses = snap.docs.map((d) => {
    const data = d.data() as Omit<Course, 'id'>;
    const course: Course = { id: d.id, name: data.name };
    if (data.archived !== undefined) course.archived = data.archived;
    return course;
  });
  return includeArchived ? courses : courses.filter((c) => c.archived !== true);
}
```

Create `src/data/listPeriods.ts`:

```ts
import {
  collection as fbCollection,
  getDocs as fbGetDocs,
  type Firestore,
} from 'firebase/firestore';
import type { Period } from '../types';

export interface PeriodReadDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
}

const defaultDeps: PeriodReadDeps = { collection: fbCollection, getDocs: fbGetDocs };

/**
 * List a course's periods from .../courses/{courseId}/periods, sorted ascending
 * by `order` so the UI renders Period 1 before Period 6 regardless of doc order.
 */
export async function listPeriods(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  deps: PeriodReadDeps = defaultDeps,
): Promise<Period[]> {
  const { collection, getDocs } = deps;
  const snap = await getDocs(
    collection(db, `teachers/${uid}/years/${yearId}/courses/${courseId}/periods`),
  );
  const periods = snap.docs.map((d) => {
    const data = d.data() as Omit<Period, 'id'>;
    return { id: d.id, label: data.label, order: data.order } as Period;
  });
  return periods.sort((a, b) => a.order - b.order);
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/data/listCoursesPeriods.test.ts` → green.

**Step 5 — Commit.** `git add src/data/listCourses.* src/data/listPeriods.* src/data/listCoursesPeriods.test.ts && git commit -m "Add listCourses + listPeriods read fns"`

---

### Task N4: `renameCourse` + `archiveCourse` data fns

**Step 1 — Write the failing test (REAL code).** Create `src/data/renameArchiveCourse.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { renameCourse } from './renameCourse';
import { archiveCourse } from './archiveCourse';

describe('renameCourse', () => {
  it('updates only the name at the course doc path', async () => {
    const doc = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const updateDoc = vi.fn(async () => {});
    const db = { __fake: true };

    await renameCourse(db as any, 'teacher-1', 'year-2026', 'course-bio', 'Honors Biology', {
      doc,
      updateDoc,
    } as any);

    expect(doc).toHaveBeenCalledWith(
      db,
      'teachers/teacher-1/years/year-2026/courses/course-bio',
    );
    expect(updateDoc.mock.calls[0][1]).toEqual({ name: 'Honors Biology' });
  });
});

describe('archiveCourse', () => {
  it('sets the archived flag at the course doc path', async () => {
    const doc = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const updateDoc = vi.fn(async () => {});
    const db = { __fake: true };

    await archiveCourse(db as any, 'teacher-1', 'year-2026', 'course-bio', true, {
      doc,
      updateDoc,
    } as any);

    expect(doc).toHaveBeenCalledWith(
      db,
      'teachers/teacher-1/years/year-2026/courses/course-bio',
    );
    expect(updateDoc.mock.calls[0][1]).toEqual({ archived: true });
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/data/renameArchiveCourse.test.ts` → fails: cannot find `./renameCourse`.

**Step 3 — Minimal implementation (REAL code).** Create `src/data/renameCourse.ts`:

```ts
import {
  doc as fbDoc,
  updateDoc as fbUpdateDoc,
  type Firestore,
} from 'firebase/firestore';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface CourseUpdateDeps {
  doc: typeof fbDoc;
  updateDoc: typeof fbUpdateDoc;
}

export const defaultCourseUpdateDeps: CourseUpdateDeps = {
  doc: fbDoc,
  updateDoc: fbUpdateDoc,
};

/** Rename a course at teachers/{uid}/years/{yearId}/courses/{courseId}. */
export async function renameCourse(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  name: string,
  deps: CourseUpdateDeps = defaultCourseUpdateDeps,
): Promise<void> {
  const { doc, updateDoc } = deps;
  await updateDoc(
    doc(db, `teachers/${uid}/years/${yearId}/courses/${courseId}`),
    { name },
  );
}
```

Create `src/data/archiveCourse.ts`:

```ts
import { type Firestore } from 'firebase/firestore';
import { type CourseUpdateDeps, defaultCourseUpdateDeps } from './renameCourse';

/**
 * Set (or clear) the archived flag on a course at
 * teachers/{uid}/years/{yearId}/courses/{courseId}. Archived courses are hidden
 * from the default course list (see listCourses) but never deleted — call with
 * `false` to restore. Non-destructive.
 */
export async function archiveCourse(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  archived: boolean,
  deps: CourseUpdateDeps = defaultCourseUpdateDeps,
): Promise<void> {
  const { doc, updateDoc } = deps;
  await updateDoc(
    doc(db, `teachers/${uid}/years/${yearId}/courses/${courseId}`),
    { archived },
  );
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/data/renameArchiveCourse.test.ts` → green.

**Step 5 — Commit.** `git add src/data/renameCourse.* src/data/archiveCourse.* src/data/renameArchiveCourse.test.ts && git commit -m "Add renameCourse + archiveCourse data fns"`

---

### Task N5: `deleteCourse` data fn (recursive sweep)

**Step 1 — Write the failing test (REAL code).** Create `src/data/deleteCourse.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { deleteCourse } from './deleteCourse';

function snap(ids: string[]) {
  return { docs: ids.map((id) => ({ id })) };
}

describe('deleteCourse', () => {
  it('deletes every period (and its students) then the course doc LAST', async () => {
    const uid = 'teacher-1';
    const yearId = 'year-2026';
    const courseId = 'course-bio';
    const base = `teachers/${uid}/years/${yearId}/courses/${courseId}`;

    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const doc = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const getDocs = vi.fn(async (ref: { __path: string }) => {
      if (ref.__path === `${base}/periods`) return snap(['p1', 'p2']);
      if (ref.__path === `${base}/periods/p1/students`) return snap(['s1']);
      if (ref.__path === `${base}/periods/p2/students`) return snap([]);
      return snap([]);
    });
    const deletedPaths: string[] = [];
    const deleteDoc = vi.fn(async (ref: { __path: string }) => {
      deletedPaths.push(ref.__path);
    });

    await deleteCourse(
      { __fake: true } as any,
      uid,
      yearId,
      courseId,
      { collection, doc, getDocs, deleteDoc } as any,
    );

    // Student under p1 and both period docs are deleted before the course doc.
    expect(deletedPaths).toContain(`${base}/periods/p1/students/s1`);
    expect(deletedPaths).toContain(`${base}/periods/p1`);
    expect(deletedPaths).toContain(`${base}/periods/p2`);
    expect(deletedPaths[deletedPaths.length - 1]).toBe(base);
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/data/deleteCourse.test.ts` → fails: cannot find `./deleteCourse`.

**Step 3 — Minimal implementation (REAL code).** Create `src/data/deleteCourse.ts`:

```ts
import {
  collection as fbCollection,
  doc as fbDoc,
  getDocs as fbGetDocs,
  deleteDoc as fbDeleteDoc,
  type Firestore,
} from 'firebase/firestore';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface CourseDeleteDeps {
  collection: typeof fbCollection;
  doc: typeof fbDoc;
  getDocs: typeof fbGetDocs;
  deleteDoc: typeof fbDeleteDoc;
}

const defaultDeps: CourseDeleteDeps = {
  collection: fbCollection,
  doc: fbDoc,
  getDocs: fbGetDocs,
  deleteDoc: fbDeleteDoc,
};

/**
 * DESTRUCTIVE. Permanently deletes a course and ALL data nested under it:
 * each period's students are removed first, then each period doc, then the
 * course doc LAST so an interrupted run never orphans children behind a missing
 * parent. The client SDK has no recursive delete, so we enumerate by hand.
 * There is no undo — callers must confirm before invoking. To merely hide a
 * course, use archiveCourse instead.
 */
export async function deleteCourse(
  db: Firestore,
  uid: string,
  yearId: string,
  courseId: string,
  deps: CourseDeleteDeps = defaultDeps,
): Promise<void> {
  const { collection, doc, getDocs, deleteDoc } = deps;
  const coursePath = `teachers/${uid}/years/${yearId}/courses/${courseId}`;
  const periodsPath = `${coursePath}/periods`;

  // 1) For each period: delete its students, then the period doc.
  const periods = await getDocs(collection(db, periodsPath));
  for (const period of periods.docs) {
    const studentsPath = `${periodsPath}/${period.id}/students`;
    const students = await getDocs(collection(db, studentsPath));
    for (const student of students.docs) {
      await deleteDoc(doc(db, `${studentsPath}/${student.id}`));
    }
    await deleteDoc(doc(db, `${periodsPath}/${period.id}`));
  }

  // 2) Delete the course doc LAST.
  await deleteDoc(doc(db, coursePath));
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/data/deleteCourse.test.ts` → green.

**Step 5 — Commit.** `git add src/data/deleteCourse.* && git commit -m "Add deleteCourse recursive-delete data fn"`

---

### Task N6: `periodFeedbackProgress` helper (read from feedbackHistory)

This pure helper turns a period's roster size + its `FeedbackHistoryEntry[]` into a `{ done, total }` progress count. It is config-aware: it counts a student as "done" for the current grading period using `GRADING_PERIODS` from `src/feedback/taxonomy.ts`, never hardcoding the list.

**Step 1 — Write the failing test (REAL code).** Create `src/feedback/periodFeedbackProgress.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { periodFeedbackProgress } from './periodFeedbackProgress';
import type { FeedbackHistoryEntry } from '../types';

function entry(studentId: string, gradingPeriod: string): FeedbackHistoryEntry {
  return {
    studentId,
    periodId: 'p1',
    courseId: 'c1',
    yearId: 'y1',
    sentAt: 1,
    gradingPeriod,
    finalText: 'x',
    tags: { areas: [], sentiments: [], standards: [] },
    usedEntries: [],
  };
}

describe('periodFeedbackProgress', () => {
  it('counts distinct students with history in the given grading period', () => {
    const history: FeedbackHistoryEntry[] = [
      entry('s1', 'Q1'),
      entry('s1', 'Q1'), // duplicate student — counts once
      entry('s2', 'Q1'),
      entry('s3', 'Q2'), // different grading period — not counted for Q1
    ];
    expect(periodFeedbackProgress(3, history, 'Q1')).toEqual({ done: 2, total: 3 });
  });

  it('is zero-safe with no history', () => {
    expect(periodFeedbackProgress(0, [], 'Q1')).toEqual({ done: 0, total: 0 });
  });

  it('clamps done to total when history exceeds roster (re-sends, removed students)', () => {
    const history = [entry('s1', 'Q1'), entry('s2', 'Q1'), entry('ghost', 'Q1')];
    expect(periodFeedbackProgress(2, history, 'Q1')).toEqual({ done: 2, total: 2 });
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/feedback/periodFeedbackProgress.test.ts` → fails: cannot find `./periodFeedbackProgress`.

**Step 3 — Minimal implementation (REAL code).** Create `src/feedback/periodFeedbackProgress.ts`:

```ts
import type { FeedbackHistoryEntry } from '../types';

export interface FeedbackProgress {
  done: number;
  total: number;
}

/**
 * Pure progress reducer for a single period card on the Home screen.
 *
 * Given a period's roster size and the FeedbackHistoryEntry[] written under that
 * period, returns how many DISTINCT students already have feedback for
 * `gradingPeriod` (e.g. 'Q1'). The grading-period value is supplied by the caller
 * from GRADING_PERIODS in src/feedback/taxonomy.ts — this helper never hardcodes
 * the list. `done` is clamped to `total` so re-sends or since-removed students
 * never push the bar past 100%.
 */
export function periodFeedbackProgress(
  rosterSize: number,
  history: FeedbackHistoryEntry[],
  gradingPeriod: string,
): FeedbackProgress {
  const distinct = new Set(
    history
      .filter((h) => h.gradingPeriod === gradingPeriod)
      .map((h) => h.studentId),
  );
  return { done: Math.min(distinct.size, rosterSize), total: rosterSize };
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/feedback/periodFeedbackProgress.test.ts` → green.

**Step 5 — Commit.** `git add src/feedback/periodFeedbackProgress.* && git commit -m "Add periodFeedbackProgress pure helper (taxonomy-driven)"`

---

### Task N7: `NavBar` component (smoke-tested)

**Step 1 — Write the failing test (REAL code).** Create `src/components/NavBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const signOutTeacher = vi.fn(() => Promise.resolve());
vi.mock('../auth/authService', () => ({ signOutTeacher: () => signOutTeacher() }));

import { NavBar } from './NavBar';

describe('NavBar', () => {
  it('renders the logo and Home/Bank links pointing at the right routes', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );
    expect(screen.getByText('Feedback')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/home');
    expect(screen.getByRole('link', { name: /bank/i })).toHaveAttribute('href', '/bank');
  });

  it('calls signOutTeacher when Sign out is clicked', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOutTeacher).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/components/NavBar.test.tsx` → fails: cannot find `./NavBar`.

**Step 3 — Minimal implementation (REAL code).** Create `src/components/NavBar.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { signOutTeacher } from '../auth/authService';
import { tokens, tealButtonStyle } from '../ui/theme';

/**
 * App chrome shown on every signed-in page: the "Feedback" wordmark (links Home)
 * plus Home / Bank nav and a Sign out button. Routing-only — no data deps — so it
 * smoke-tests under a bare MemoryRouter.
 */
export function NavBar() {
  const linkStyle = { color: tokens.color.subtle, fontWeight: 600, textDecoration: 'none' };
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.space(3),
        padding: `${tokens.space(1.5)}px ${tokens.space(3)}px`,
        background: tokens.color.panel,
        borderBottom: `1px solid ${tokens.color.border}`,
      }}
    >
      <Link
        to="/home"
        style={{ ...linkStyle, color: tokens.color.teal, fontSize: 18, letterSpacing: '-0.01em' }}
      >
        Feedback
      </Link>
      <nav style={{ display: 'flex', gap: tokens.space(2), flex: 1 }}>
        <Link to="/home" style={linkStyle}>
          Home
        </Link>
        <Link to="/bank" style={linkStyle}>
          Bank
        </Link>
      </nav>
      <button
        type="button"
        onClick={() => void signOutTeacher()}
        style={{ ...tealButtonStyle(), padding: '6px 14px' }}
      >
        Sign out
      </button>
    </header>
  );
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/components/NavBar.test.tsx` → green.

**Step 5 — Commit.** `git add src/components/NavBar.* && git commit -m "Add NavBar component (logo, Home/Bank, Sign out)"`

---

### Task N8: `Breadcrumbs` component (Year › Course › Period, clickable)

**Step 1 — Write the failing test (REAL code).** Create `src/components/Breadcrumbs.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumbs } from './Breadcrumbs';

describe('Breadcrumbs', () => {
  it('renders Year › Course › Period with links for the crumbs that have a `to`', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs
          items={[
            { label: '2025–26', to: '/home' },
            { label: 'Biology', to: '/setup' },
            { label: 'Period 3' },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: '2025–26' })).toHaveAttribute('href', '/home');
    expect(screen.getByRole('link', { name: 'Biology' })).toHaveAttribute('href', '/setup');
    // The last crumb (current location) is plain text, not a link.
    expect(screen.queryByRole('link', { name: 'Period 3' })).toBeNull();
    expect(screen.getByText('Period 3')).toBeInTheDocument();
    // Two separators between three crumbs.
    expect(screen.getAllByText('›')).toHaveLength(2);
  });

  it('renders nothing when given no items', () => {
    const { container } = render(
      <MemoryRouter>
        <Breadcrumbs items={[]} />
      </MemoryRouter>,
    );
    expect(container.querySelector('nav')).toBeNull();
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/components/Breadcrumbs.test.tsx` → fails: cannot find `./Breadcrumbs`.

**Step 3 — Minimal implementation (REAL code).** Create `src/components/Breadcrumbs.tsx`:

```tsx
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { tokens } from '../ui/theme';

export interface Crumb {
  label: string;
  /** When present the crumb is a Link; the current (last) crumb omits it and renders as text. */
  to?: string;
}

/**
 * Year › Course › Period trail. Crumbs with a `to` are clickable Links; the
 * trailing crumb (the current location) is plain text. Renders nothing for an
 * empty trail so callers can pass a still-loading [].
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.space(1),
        fontSize: 14,
        color: tokens.color.muted,
        padding: `${tokens.space(1)}px ${tokens.space(3)}px`,
      }}
    >
      {items.map((c, i) => (
        <Fragment key={`${c.label}-${i}`}>
          {i > 0 && <span aria-hidden="true">›</span>}
          {c.to ? (
            <Link to={c.to} style={{ color: tokens.color.teal, textDecoration: 'none' }}>
              {c.label}
            </Link>
          ) : (
            <span style={{ color: tokens.color.text }}>{c.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/components/Breadcrumbs.test.tsx` → green.

**Step 5 — Commit.** `git add src/components/Breadcrumbs.* && git commit -m "Add clickable Year › Course › Period Breadcrumbs"`

---

### Task N9: `AddCourseCard` component (name + period checkboxes 1–6 + custom period)

A self-contained, fully tested form component that SetupPage will mount. It collects a course name, lets the teacher tick standard periods 1–6, and add one or more custom period labels, then calls `onCreate({ name, periods })` where each period carries a display `label` and an `order` (1–6 for the standard ones, sequential after for custom).

**Step 1 — Write the failing test (REAL code).** Create `src/components/AddCourseCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddCourseCard } from './AddCourseCard';

describe('AddCourseCard', () => {
  it('submits the course name with the checked periods (1–6) as {label, order}', () => {
    const onCreate = vi.fn();
    render(<AddCourseCard onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('Course name'), {
      target: { value: 'Biology' },
    });
    fireEvent.click(screen.getByLabelText('Period 1'));
    fireEvent.click(screen.getByLabelText('Period 3'));
    fireEvent.click(screen.getByRole('button', { name: /add course/i }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Biology',
      periods: [
        { label: 'Period 1', order: 1 },
        { label: 'Period 3', order: 3 },
      ],
    });
  });

  it('adds a custom period after the standard ones with the next order', () => {
    const onCreate = vi.fn();
    render(<AddCourseCard onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('Course name'), { target: { value: 'Seminar' } });
    fireEvent.click(screen.getByLabelText('Period 2'));
    fireEvent.change(screen.getByLabelText('Add custom period'), {
      target: { value: 'Advisory' },
    });
    fireEvent.click(screen.getByRole('button', { name: '+ Add custom period' }));
    fireEvent.click(screen.getByRole('button', { name: /add course/i }));

    expect(onCreate).toHaveBeenCalledWith({
      name: 'Seminar',
      periods: [
        { label: 'Period 2', order: 2 },
        { label: 'Advisory', order: 7 },
      ],
    });
  });

  it('does not submit without a course name', () => {
    const onCreate = vi.fn();
    render(<AddCourseCard onCreate={onCreate} />);
    fireEvent.click(screen.getByLabelText('Period 1'));
    fireEvent.click(screen.getByRole('button', { name: /add course/i }));
    expect(onCreate).not.toHaveBeenCalled();
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/components/AddCourseCard.test.tsx` → fails: cannot find `./AddCourseCard`.

**Step 3 — Minimal implementation (REAL code).** Create `src/components/AddCourseCard.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { tokens, panelStyle, tealButtonStyle } from '../ui/theme';

export interface NewPeriodInput {
  label: string;
  order: number;
}

export interface NewCourseInput {
  name: string;
  periods: NewPeriodInput[];
}

export interface AddCourseCardProps {
  onCreate: (course: NewCourseInput) => void;
}

const STANDARD_PERIODS = [1, 2, 3, 4, 5, 6] as const;

/**
 * "Add a course" card: a course-name input, checkboxes for the standard
 * periods 1–6, and a "+ Add custom period" field for anything else (Advisory,
 * Homeroom…). On submit it emits {name, periods} where standard periods keep
 * their number as `order` and custom periods are appended with order 7, 8, …
 * Standard periods always sort before custom ones. The component owns no data
 * access — SetupPage wires `onCreate` to createCourse + createPeriod.
 */
export function AddCourseCard({ onCreate }: AddCourseCardProps) {
  const [name, setName] = useState('');
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [customDraft, setCustomDraft] = useState('');
  const [customPeriods, setCustomPeriods] = useState<string[]>([]);

  function toggle(n: number) {
    setChecked((prev) => ({ ...prev, [n]: !prev[n] }));
  }

  function addCustom() {
    const label = customDraft.trim();
    if (label === '') return;
    setCustomPeriods((prev) => [...prev, label]);
    setCustomDraft('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() === '') return;
    const standard: NewPeriodInput[] = STANDARD_PERIODS.filter((n) => checked[n]).map((n) => ({
      label: `Period ${n}`,
      order: n,
    }));
    // Custom periods are ordered after the highest standard slot (6) → 7, 8, …
    const custom: NewPeriodInput[] = customPeriods.map((label, i) => ({
      label,
      order: STANDARD_PERIODS.length + 1 + i,
    }));
    onCreate({ name: name.trim(), periods: [...standard, ...custom] });
    setName('');
    setChecked({});
    setCustomPeriods([]);
    setCustomDraft('');
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...panelStyle(), maxWidth: 520, display: 'grid', gap: tokens.space(2) }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Add a course</h2>

      <label htmlFor="course-name" style={{ display: 'grid', gap: 4 }}>
        Course name
        <input id="course-name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: tokens.space(1.5) }}>
        <legend style={{ color: tokens.color.muted, fontSize: 14 }}>Periods</legend>
        {STANDARD_PERIODS.map((n) => (
          <label key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={!!checked[n]} onChange={() => toggle(n)} />
            Period {n}
          </label>
        ))}
      </fieldset>

      <div style={{ display: 'flex', gap: tokens.space(1), alignItems: 'end' }}>
        <label htmlFor="custom-period" style={{ display: 'grid', gap: 4, flex: 1 }}>
          Add custom period
          <input
            id="custom-period"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
          />
        </label>
        <button type="button" onClick={addCustom} style={{ ...tealButtonStyle(), padding: '8px 12px' }}>
          + Add custom period
        </button>
      </div>

      {customPeriods.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: tokens.space(2), color: tokens.color.subtle }}>
          {customPeriods.map((label, i) => (
            <li key={`${label}-${i}`}>{label}</li>
          ))}
        </ul>
      )}

      <button type="submit" style={tealButtonStyle()}>
        Add course
      </button>
    </form>
  );
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/components/AddCourseCard.test.tsx` → green.

**Step 5 — Commit.** `git add src/components/AddCourseCard.* && git commit -m "Add AddCourseCard (name + period checkboxes + custom period)"`

---

### Task N10: `SetupPage` (/setup) wired to course/period data fns

Mounts `AddCourseCard` and the existing-courses management list. On create it calls `createCourse` then `createPeriod` once per period; the existing-courses list offers rename / archive / delete. Firestore + auth are injectable via a `deps` prop, exactly like `RosterPage`.

**Step 1 — Write the failing test (REAL code).** Create `src/pages/SetupPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Course } from '../types';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'teacher-1', email: 't@x.edu' } }),
}));

import { SetupPage } from './SetupPage';

const courses: Course[] = [{ id: 'course-bio', name: 'Biology', archived: false }];

function makeDeps() {
  return {
    uid: 'teacher-1',
    yearId: 'year-2026',
    listCourses: vi.fn(async () => courses),
    createCourse: vi.fn(async () => 'course-new'),
    createPeriod: vi.fn(async () => 'period-new'),
    renameCourse: vi.fn(async () => {}),
    archiveCourse: vi.fn(async () => {}),
    deleteCourse: vi.fn(async () => {}),
  };
}

describe('SetupPage', () => {
  it('loads and lists existing courses', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter>
        <SetupPage deps={deps} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Biology')).toBeInTheDocument();
    expect(deps.listCourses).toHaveBeenCalledWith(
      { __fake: true },
      'teacher-1',
      'year-2026',
      undefined,
      { includeArchived: false },
    );
  });

  it('creating a course calls createCourse then createPeriod per checked period', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter>
        <SetupPage deps={deps} />
      </MemoryRouter>,
    );
    fireEvent.change(await screen.findByLabelText('Course name'), {
      target: { value: 'Chemistry' },
    });
    fireEvent.click(screen.getByLabelText('Period 1'));
    fireEvent.click(screen.getByLabelText('Period 2'));
    fireEvent.click(screen.getByRole('button', { name: /add course/i }));

    await waitFor(() =>
      expect(deps.createCourse).toHaveBeenCalledWith(
        { __fake: true },
        'teacher-1',
        'year-2026',
        { name: 'Chemistry' },
      ),
    );
    await waitFor(() => expect(deps.createPeriod).toHaveBeenCalledTimes(2));
    expect(deps.createPeriod).toHaveBeenCalledWith(
      { __fake: true },
      'teacher-1',
      'year-2026',
      'course-new',
      { label: 'Period 1', order: 1 },
    );
    expect(deps.createPeriod).toHaveBeenCalledWith(
      { __fake: true },
      'teacher-1',
      'year-2026',
      'course-new',
      { label: 'Period 2', order: 2 },
    );
  });

  it('archives a course via its Archive button', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter>
        <SetupPage deps={deps} />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /^archive$/i }));
    await waitFor(() =>
      expect(deps.archiveCourse).toHaveBeenCalledWith(
        { __fake: true },
        'teacher-1',
        'year-2026',
        'course-bio',
        true,
      ),
    );
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/pages/SetupPage.test.tsx` → fails: cannot find `./SetupPage`.

**Step 3 — Minimal implementation (REAL code).** Create `src/pages/SetupPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { getOrCreateCurrentYear } from '../data/getOrCreateCurrentYear';
import { listCourses } from '../data/listCourses';
import { createCourse } from '../data/createCourse';
import { createPeriod } from '../data/createPeriod';
import { renameCourse } from '../data/renameCourse';
import { archiveCourse } from '../data/archiveCourse';
import { deleteCourse } from '../data/deleteCourse';
import { AddCourseCard, type NewCourseInput } from '../components/AddCourseCard';
import { NavBar } from '../components/NavBar';
import { Breadcrumbs } from '../components/Breadcrumbs';
import type { Course } from '../types';
import { tokens, panelStyle } from '../ui/theme';

/** Firestore/auth are injectable so the smoke test drives it without a backend. */
export interface SetupPageDeps {
  uid: string;
  yearId: string;
  listCourses: typeof listCourses;
  createCourse: typeof createCourse;
  createPeriod: typeof createPeriod;
  renameCourse: typeof renameCourse;
  archiveCourse: typeof archiveCourse;
  deleteCourse: typeof deleteCourse;
}

export function SetupPage({ deps }: { deps?: Partial<SetupPageDeps> }) {
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const api = {
    listCourses: deps?.listCourses ?? listCourses,
    createCourse: deps?.createCourse ?? createCourse,
    createPeriod: deps?.createPeriod ?? createPeriod,
    renameCourse: deps?.renameCourse ?? renameCourse,
    archiveCourse: deps?.archiveCourse ?? archiveCourse,
    deleteCourse: deps?.deleteCourse ?? deleteCourse,
  };

  const [yearId, setYearId] = useState<string>(deps?.yearId ?? '');
  const [showArchived, setShowArchived] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Resolve the current year on mount (Phase-1 getOrCreateCurrentYear); the test
  // injects yearId so this branch is skipped under the mock.
  useEffect(() => {
    if (!uid || yearId) return;
    getOrCreateCurrentYear(db, uid)
      .then((y) => setYearId(y.id))
      .catch(() => setError('Could not load the current year.'));
  }, [uid, yearId]);

  function reloadCourses(yId: string) {
    api
      .listCourses(db, uid, yId, undefined, { includeArchived: showArchived })
      .then(setCourses)
      .catch(() => setError('Could not load courses.'));
  }

  useEffect(() => {
    if (!uid || !yearId) return;
    reloadCourses(yearId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, yearId, showArchived]);

  async function handleCreateCourse(input: NewCourseInput) {
    setError(null);
    try {
      const courseId = await api.createCourse(db, uid, yearId, { name: input.name });
      for (const p of input.periods) {
        await api.createPeriod(db, uid, yearId, courseId, { label: p.label, order: p.order });
      }
      reloadCourses(yearId);
    } catch {
      setError('Could not create the course.');
    }
  }

  async function handleRename(courseId: string) {
    const name = window.prompt('New course name?');
    if (!name) return;
    await api.renameCourse(db, uid, yearId, courseId, name);
    reloadCourses(yearId);
  }

  async function handleArchive(courseId: string, archived: boolean) {
    await api.archiveCourse(db, uid, yearId, courseId, archived);
    reloadCourses(yearId);
  }

  async function handleDelete(courseId: string, name: string) {
    const typed = window.prompt(
      `Permanently delete "${name}" and ALL its periods, students, and feedback history? This cannot be undone. Type the course name to confirm:`,
    );
    if (typed !== name) return;
    await api.deleteCourse(db, uid, yearId, courseId);
    reloadCourses(yearId);
  }

  return (
    <>
      <NavBar />
      <Breadcrumbs items={[{ label: 'Home', to: '/home' }, { label: 'Setup' }]} />
      <main style={{ maxWidth: 880, margin: '0 auto', padding: tokens.space(4) }}>
        <h1>Setup</h1>
        {error && <p role="alert">{error}</p>}

        <AddCourseCard onCreate={handleCreateCourse} />

        <section style={{ marginTop: tokens.space(4) }} aria-label="Your courses">
          <h2>Your courses</h2>
          <label>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived courses
          </label>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: tokens.space(1) }}>
            {courses.map((c) => (
              <li key={c.id} style={{ ...panelStyle(), display: 'flex', alignItems: 'center', gap: tokens.space(1) }}>
                <span style={{ flex: 1 }}>
                  {c.name}
                  {c.archived ? ' (archived)' : ''}
                </span>
                <button type="button" onClick={() => handleRename(c.id)}>
                  Rename
                </button>
                <button type="button" onClick={() => handleArchive(c.id, !c.archived)}>
                  {c.archived ? 'Unarchive' : 'Archive'}
                </button>
                <button type="button" className="danger" onClick={() => handleDelete(c.id, c.name)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/pages/SetupPage.test.tsx` → green.

**Step 5 — Commit.** `git add src/pages/SetupPage.* && git commit -m "Add SetupPage wired to course/period CRUD"`

---

### Task N11: `HomePage` redesign (greeting + course cards with per-period progress)

Replaces the placeholder `HomePage`. For each course it renders a card listing its periods; each period row shows a `done/total` feedback-progress count (via `periodFeedbackProgress`, fed by `listFeedbackHistory` and the current grading period from `taxonomy.ts`) plus **Write feedback** and **Trends** links. There is an **+ Add course** card linking to `/setup` and a **Bank** entry point. Data is injectable via a `deps` prop.

**Step 1 — Write the failing test (REAL code).** Create `src/pages/HomePage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Course, Period } from '../types';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'teacher-1', email: 't@x.edu' } }),
}));
vi.mock('../auth/authService', () => ({ signOutTeacher: vi.fn(() => Promise.resolve()) }));

import HomePage from './HomePage';

const courses: Course[] = [{ id: 'course-bio', name: 'Biology', archived: false }];
const periods: Period[] = [{ id: 'p1', label: 'Period 1', order: 1 }];

function makeDeps() {
  return {
    uid: 'teacher-1',
    yearId: 'year-2026',
    gradingPeriod: 'Q1',
    listCourses: vi.fn(async () => courses),
    listPeriods: vi.fn(async () => periods),
    rosterSize: vi.fn(async () => 3),
    listFeedbackHistory: vi.fn(async () => [
      {
        studentId: 's1',
        periodId: 'p1',
        courseId: 'course-bio',
        yearId: 'year-2026',
        sentAt: 1,
        gradingPeriod: 'Q1',
        finalText: 'x',
        tags: { areas: [], sentiments: [], standards: [] },
        usedEntries: [],
      },
    ]),
  };
}

describe('HomePage', () => {
  it('greets the signed-in teacher', async () => {
    render(
      <MemoryRouter>
        <HomePage deps={makeDeps()} />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/t@x.edu/)).toBeInTheDocument();
  });

  it('renders a course card with each period and its feedback progress', async () => {
    render(
      <MemoryRouter>
        <HomePage deps={makeDeps()} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Biology')).toBeInTheDocument();
    expect(await screen.findByText('Period 1')).toBeInTheDocument();
    // 1 of 3 students have Q1 feedback.
    await waitFor(() => expect(screen.getByText('1 / 3')).toBeInTheDocument());
  });

  it('links each period to Write feedback and Trends', async () => {
    render(
      <MemoryRouter>
        <HomePage deps={makeDeps()} />
      </MemoryRouter>,
    );
    const write = await screen.findByRole('link', { name: /write feedback/i });
    const trends = await screen.findByRole('link', { name: /trends/i });
    expect(write).toHaveAttribute('href', '/compose/course-bio/p1');
    expect(trends).toHaveAttribute('href', '/trends/course-bio/p1');
  });

  it('shows an + Add course card linking to /setup and a Bank entry point', async () => {
    render(
      <MemoryRouter>
        <HomePage deps={makeDeps()} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: /add course/i })).toHaveAttribute('href', '/setup');
    expect(screen.getByRole('link', { name: /^bank$/i })).toHaveAttribute('href', '/bank');
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/pages/HomePage.test.tsx` → fails: current `HomePage` accepts no `deps` and renders none of this.

**Step 3 — Minimal implementation (REAL code).** Replace `src/pages/HomePage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { getOrCreateCurrentYear } from '../data/getOrCreateCurrentYear';
import { listCourses } from '../data/listCourses';
import { listPeriods } from '../data/listPeriods';
import { rosterSize } from '../data/rosterSize';
import { listFeedbackHistory } from '../data/listFeedbackHistory';
import { periodFeedbackProgress } from '../feedback/periodFeedbackProgress';
import { CURRENT_GRADING_PERIOD } from '../feedback/taxonomy';
import { NavBar } from '../components/NavBar';
import type { Course, Period } from '../types';
import { tokens, panelStyle } from '../ui/theme';

/** A period row already resolved with its progress count, ready to render. */
interface PeriodRow extends Period {
  done: number;
  total: number;
}
interface CourseCard {
  course: Course;
  periods: PeriodRow[];
}

/** Data deps are injectable so the smoke test drives Home without a backend. */
export interface HomePageDeps {
  uid: string;
  yearId: string;
  gradingPeriod: string;
  listCourses: typeof listCourses;
  listPeriods: typeof listPeriods;
  rosterSize: typeof rosterSize;
  listFeedbackHistory: typeof listFeedbackHistory;
}

export default function HomePage({ deps }: { deps?: Partial<HomePageDeps> }) {
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const gradingPeriod = deps?.gradingPeriod ?? CURRENT_GRADING_PERIOD;
  const api = {
    listCourses: deps?.listCourses ?? listCourses,
    listPeriods: deps?.listPeriods ?? listPeriods,
    rosterSize: deps?.rosterSize ?? rosterSize,
    listFeedbackHistory: deps?.listFeedbackHistory ?? listFeedbackHistory,
  };

  const [yearId, setYearId] = useState<string>(deps?.yearId ?? '');
  const [cards, setCards] = useState<CourseCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || yearId) return;
    getOrCreateCurrentYear(db, uid)
      .then((y) => setYearId(y.id))
      .catch(() => setError('Could not load the current year.'));
  }, [uid, yearId]);

  useEffect(() => {
    if (!uid || !yearId) return;
    let cancelled = false;
    (async () => {
      try {
        const courses = await api.listCourses(db, uid, yearId, undefined, {
          includeArchived: false,
        });
        const built = await Promise.all(
          courses.map(async (course) => {
            const periods = await api.listPeriods(db, uid, yearId, course.id);
            const rows = await Promise.all(
              periods.map(async (p) => {
                const total = await api.rosterSize(db, uid, yearId, course.id, p.id);
                const history = await api.listFeedbackHistory(db, uid, {
                  yearId,
                  courseId: course.id,
                  periodId: p.id,
                });
                const { done } = periodFeedbackProgress(total, history, gradingPeriod);
                return { ...p, done, total };
              }),
            );
            return { course, periods: rows };
          }),
        );
        if (!cancelled) setCards(built);
      } catch {
        if (!cancelled) setError('Could not load your courses.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, yearId, gradingPeriod]);

  return (
    <>
      <NavBar />
      <main style={{ maxWidth: 980, margin: '0 auto', padding: tokens.space(4) }}>
        <h1 style={{ fontSize: 28, letterSpacing: '-0.01em' }}>Welcome back</h1>
        <p style={{ color: tokens.color.muted }}>Signed in as {user?.email}</p>
        {error && <p role="alert">{error}</p>}

        <p>
          <Link to="/bank" style={{ color: tokens.color.teal, fontWeight: 600 }}>
            Bank
          </Link>
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: tokens.space(2),
            marginTop: tokens.space(2),
          }}
        >
          {cards.map(({ course, periods }) => (
            <section key={course.id} style={panelStyle()} aria-label={course.name}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>{course.name}</h2>
              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: tokens.space(1) }}>
                {periods.map((p) => (
                  <li
                    key={p.id}
                    style={{ display: 'flex', alignItems: 'center', gap: tokens.space(1) }}
                  >
                    <span style={{ flex: 1 }}>{p.label}</span>
                    <span style={{ color: tokens.color.muted, fontVariantNumeric: 'tabular-nums' }}>
                      {p.done} / {p.total}
                    </span>
                    <Link to={`/compose/${course.id}/${p.id}`} style={{ color: tokens.color.teal }}>
                      Write feedback
                    </Link>
                    <Link to={`/trends/${course.id}/${p.id}`} style={{ color: tokens.color.teal }}>
                      Trends
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <Link
            to="/setup"
            style={{
              ...panelStyle(),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: tokens.color.teal,
              fontWeight: 600,
              textDecoration: 'none',
              minHeight: 96,
            }}
          >
            + Add course
          </Link>
        </div>
      </main>
    </>
  );
}
```

> **Phase-1 imports used here:** `getOrCreateCurrentYear`, `rosterSize(db, uid, yearId, courseId, periodId)`, `listFeedbackHistory(db, uid, {yearId,courseId,periodId})`, and `CURRENT_GRADING_PERIOD` from `src/feedback/taxonomy.ts`. If Phase 1 names the current-grading-period accessor differently, alias it at import — the value must come from `taxonomy.ts`, never inlined.

**Step 4 — Run, expect PASS.** `npx vitest run src/pages/HomePage.test.tsx` → green.

**Step 5 — Commit.** `git add src/pages/HomePage.* && git commit -m "Redesign HomePage: course cards with per-period feedback progress"`

---

### Task N12: Wire routes (`/home`, `/setup`) + first-load year bootstrap

Adds `/setup` to the route table, keeps `/home` pointed at the redesigned HomePage, and adds an `AppBootstrap` that calls `getOrCreateCurrentYear` once on first authenticated load so the year exists before any page reads it. The compose/trends routes now carry `:courseId/:periodId` to match the new Home links.

**Step 1 — Write the failing test (REAL code).** Append to `src/App.test.tsx` (new describe block — keep the existing tests):

```tsx
describe('redesigned setup/home routing', () => {
  it('renders SetupPage at /setup when signed in', () => {
    useAuthMock.mockReturnValue({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } });
    render(
      <MemoryRouter initialEntries={['/setup']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByText('setup-page')).toBeInTheDocument();
  });

  it('renders the redesigned HomePage at /home when signed in', () => {
    useAuthMock.mockReturnValue({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } });
    render(
      <MemoryRouter initialEntries={['/home']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByText('home-page')).toBeInTheDocument();
  });
});
```

Add these stubs to the top mock section of `src/App.test.tsx` (alongside the existing `vi.mock('./pages/ComposePage', …)`):

```tsx
vi.mock('./pages/SetupPage', () => ({ SetupPage: () => <div>setup-page</div> }));
vi.mock('./pages/HomePage', () => ({ default: () => <div>home-page</div> }));
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/App.test.tsx` → the two new cases fail (`/setup` has no route → bounced to landing; `home-page` stub asserts the new default export wiring).

**Step 3 — Minimal implementation (REAL code).** Add the import and `/setup` route in `src/App.tsx`:

```tsx
import { SetupPage } from './pages/SetupPage';
```

Insert this route inside `<Routes>` (after the `/home` route, before the catch-all):

```tsx
      <Route
        path="/setup"
        element={
          <RequireAuth>
            <SetupPage />
          </RequireAuth>
        }
      />
```

Then add the first-load year bootstrap. Create `src/AppBootstrap.tsx`:

```tsx
import { useEffect } from 'react';
import { useAuth } from './auth/useAuth';
import { db } from './firebase/config';
import { getOrCreateCurrentYear } from './data/getOrCreateCurrentYear';

/**
 * Fire-and-forget: the first time a teacher is signed in, ensure the current
 * year doc exists (teachers/{uid}/years/{yearId}) so every downstream page can
 * read it without a race. Idempotent — getOrCreateCurrentYear no-ops if present.
 */
export function AppBootstrap() {
  const { status, user } = useAuth();
  useEffect(() => {
    if (status !== 'signedIn' || !user?.uid) return;
    void getOrCreateCurrentYear(db, user.uid);
  }, [status, user?.uid]);
  return null;
}
```

Mount it in the default `App` export in `src/App.tsx`:

```tsx
import { AppBootstrap } from './AppBootstrap';

export default function App() {
  return (
    <>
      <AppBootstrap />
      <AppRoutes />
    </>
  );
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/App.test.tsx` → green (existing routing cases still pass; new `/setup` and `/home` cases pass).

**Step 5 — Commit.** `git add src/App.tsx src/AppBootstrap.tsx src/App.test.tsx && git commit -m "Wire /setup route + first-load getOrCreateCurrentYear bootstrap"`

---

### Task N13: Full-suite regression gate

**Step 1 — Run the whole suite.** `npm test` (runs `vitest run`, excluding the emulator rules test per package.json — `test:rules` is separate).

**Step 2 — Expect PASS.** All prior 263 tests plus the ~16 new Phase-2 tests are green; no regressions. If any fail, fix forward within the failing task's files before proceeding — do not weaken assertions.

**Step 3 — Type-check.** `npx tsc -b --noEmit` (or `npm run build`'s `tsc -b` step) passes with the new types and imports resolved.

**Step 4 — Commit (only if a fix was needed).** `git commit -am "Phase 2 regression gate: full suite + typecheck green"` — otherwise skip; nothing to commit.

---

### Notes for the assembler / downstream phases

- **Phase ordering:** This phase imports from Phase 1: `src/feedback/taxonomy.ts` (`CURRENT_GRADING_PERIOD`, plus `GRADING_PERIODS` available for `periodFeedbackProgress` callers), the `Year`/`Course`/`Period`/`FeedbackHistoryEntry` types in `src/types.ts`, `getOrCreateCurrentYear`, `rosterSize`, and `listFeedbackHistory`. If those names land slightly differently, alias at the import site — but the grading-period list and sentiment map MUST stay sourced from `taxonomy.ts`.
- **Compose/Trends links** point at `/compose/:courseId/:periodId` and `/trends/:courseId/:periodId`. The compose-flow phase owns wiring those routes (replacing the old `/compose/:classId`) and the existing `ComposeScreen`/`SendStepper` to the new period path + `feedbackHistory` write-on-send; this phase only emits the links.
- **`rosterSize`** is referenced as `rosterSize(db, uid, yearId, courseId, periodId): Promise<number>`; if Phase 1 instead exposes a `listStudents`-style fn for the new path, adapt the HomePage `api.rosterSize` call to `(await listStudents(...)).length` at the same call site.

**Relevant existing files referenced (absolute paths):**
- `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/data/createClass.ts` (+ `.test.ts`) — DI write-fn pattern mirrored by createCourse/createPeriod.
- `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/data/listClasses.ts`, `renameClass.ts`, `archiveClass.ts`, `deleteClass.ts` — patterns for list/rename/archive/recursive-delete mirrored for courses.
- `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/pages/RosterPage.tsx` (+ `.test.tsx`) — the `deps`-prop + `vi.mock('../firebase/config')`/`vi.mock('../auth/useAuth')` + MemoryRouter smoke-test pattern mirrored by SetupPage/HomePage.
- `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/App.tsx` (+ `.test.tsx`) — `AppRoutes`/`RequireAuth` route table and stub-the-page route test pattern.
- `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/ui/theme.ts` — `tokens`, `panelStyle`, `tealButtonStyle`, `chipStyle` used for all new UI.
- `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/auth/authService.ts` (`signOutTeacher`) — used by NavBar.

**Note on the spec path:** the prompt cited `docs/superpowers/specs/2026-06-16-year-course-period-redesign.md`, which does not exist in the repo; the only spec present is `docs/superpowers/specs/2026-06-16-personalized-student-feedback-emails-design.md` (the original pilot design). I drafted this phase against that spec plus the CANONICAL DECISIONS in the orchestrator prompt (the new year→course→period paths, taxonomy config, and new types), which are self-sufficient. No `taxonomy.ts`, `Year`/`Course`/`Period`/`FeedbackHistoryEntry` types, or `getOrCreateCurrentYear`/`listFeedbackHistory`/`rosterSize` exist yet — they are Phase-1 deliverables this phase imports.

---

## Phase 3 — Roster

### Task R1: CSV roster template generator (`buildRosterTemplateCsv`)

A pure function that returns a correctly-formatted `name,email` CSV string for teachers to fill and re-upload. It must produce headers the existing `parseRoster` / `mapColumns` recognize, plus one example row, so a downloaded-then-uploaded template round-trips cleanly.

**Step 1 — Write the failing test (REAL code).**

Create `src/roster/rosterTemplate.test.ts`:

```ts
// src/roster/rosterTemplate.test.ts
import { describe, it, expect } from 'vitest';
import { buildRosterTemplateCsv } from './rosterTemplate';
import { parseRoster } from './parseRoster';

describe('buildRosterTemplateCsv', () => {
  it('returns a name,email CSV with a header row and one example row', () => {
    const csv = buildRosterTemplateCsv();
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('name,email');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('Ada Lovelace,ada.lovelace@school.edu');
  });

  it('round-trips through parseRoster: the example row imports cleanly', () => {
    const result = parseRoster(buildRosterTemplateCsv());
    expect(result.columnMapping.name).toBe('name');
    expect(result.columnMapping.email).toBe('email');
    expect(result.students).toEqual([
      { name: 'Ada Lovelace', email: 'ada.lovelace@school.edu', period: '', sourceRow: 2 },
    ]);
    expect(result.skipped).toEqual([]);
  });

  it('ends with a trailing newline so editors append rows on a fresh line', () => {
    expect(buildRosterTemplateCsv().endsWith('\n')).toBe(true);
  });
});
```

**Step 2 — Run it; expect FAIL.**

```
npx vitest run src/roster/rosterTemplate.test.ts
```

Expected: fails to resolve `./rosterTemplate` (module does not exist).

**Step 3 — Minimal implementation (REAL code).**

Create `src/roster/rosterTemplate.ts`:

```ts
// src/roster/rosterTemplate.ts

/** Logical header order for the downloadable roster template. */
export const ROSTER_TEMPLATE_HEADERS = ['name', 'email'] as const;

/** One example row so teachers see the expected shape (imports cleanly via parseRoster). */
const EXAMPLE_ROW = ['Ada Lovelace', 'ada.lovelace@school.edu'] as const;

/**
 * Build the `name,email` CSV template a teacher downloads, fills, and re-uploads.
 * Pure (no I/O). Headers match what mapColumns/parseRoster recognize, and the single
 * example row round-trips through parseRoster with no skips. Trailing newline so the
 * teacher's first added row lands on a fresh line.
 */
export function buildRosterTemplateCsv(): string {
  const header = ROSTER_TEMPLATE_HEADERS.join(',');
  const example = EXAMPLE_ROW.join(',');
  return `${header}\n${example}\n`;
}
```

**Step 4 — Run it; expect PASS.**

```
npx vitest run src/roster/rosterTemplate.test.ts
```

Expected: all three tests green.

**Step 5 — Commit.**

```
git add src/roster/rosterTemplate.ts src/roster/rosterTemplate.test.ts
git commit -m "Add roster CSV template generator (name,email round-trips via parseRoster)"
```

---

### Task R2: Trigger a browser download of the template (`downloadRosterTemplate`)

A small browser-side helper that turns the template string into a Blob download named `roster-template.csv`. Kept separate from the pure generator so the generator stays I/O-free and this DOM glue is independently unit-testable with injected document/URL primitives.

**Step 1 — Write the failing test (REAL code).**

Create `src/roster/downloadRosterTemplate.test.ts`:

```ts
// src/roster/downloadRosterTemplate.test.ts
import { describe, it, expect, vi } from 'vitest';
import { downloadRosterTemplate } from './downloadRosterTemplate';
import { buildRosterTemplateCsv } from './rosterTemplate';

describe('downloadRosterTemplate', () => {
  it('creates an object URL from a CSV blob and clicks a named anchor', () => {
    const click = vi.fn();
    const anchor = { href: '', download: '', click } as unknown as HTMLAnchorElement;
    const createElement = vi.fn(() => anchor);
    const createObjectURL = vi.fn(() => 'blob:fake-url');
    const revokeObjectURL = vi.fn();

    downloadRosterTemplate({
      createElement: createElement as unknown as Document['createElement'],
      createObjectURL,
      revokeObjectURL,
    });

    expect(createElement).toHaveBeenCalledWith('a');
    // The blob URL was generated from the template's contents.
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('text/csv');
    expect(anchor.href).toBe('blob:fake-url');
    expect(anchor.download).toBe('roster-template.csv');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('the blob text equals buildRosterTemplateCsv()', async () => {
    let captured: Blob | undefined;
    const anchor = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
    downloadRosterTemplate({
      createElement: (() => anchor) as unknown as Document['createElement'],
      createObjectURL: ((b: Blob) => {
        captured = b;
        return 'blob:x';
      }) as unknown as typeof URL.createObjectURL,
      revokeObjectURL: vi.fn(),
    });
    expect(await captured!.text()).toBe(buildRosterTemplateCsv());
  });
});
```

**Step 2 — Run it; expect FAIL.**

```
npx vitest run src/roster/downloadRosterTemplate.test.ts
```

Expected: fails to resolve `./downloadRosterTemplate`.

**Step 3 — Minimal implementation (REAL code).**

Create `src/roster/downloadRosterTemplate.ts`:

```ts
// src/roster/downloadRosterTemplate.ts
import { buildRosterTemplateCsv } from './rosterTemplate';

/** Injectable DOM/URL primitives — default to the real browser globals, overridable in tests. */
export interface DownloadDeps {
  createElement: Document['createElement'];
  createObjectURL: typeof URL.createObjectURL;
  revokeObjectURL: typeof URL.revokeObjectURL;
}

const defaultDeps: DownloadDeps = {
  createElement: (tag: string) => document.createElement(tag),
  createObjectURL: (obj: Blob | MediaSource) => URL.createObjectURL(obj),
  revokeObjectURL: (url: string) => URL.revokeObjectURL(url),
};

/**
 * Trigger a client-side download of the roster CSV template as `roster-template.csv`.
 * Builds a text/csv Blob from buildRosterTemplateCsv(), wires it to a transient anchor,
 * clicks it, then revokes the object URL. DOM/URL access is injected for testability.
 */
export function downloadRosterTemplate(deps: Partial<DownloadDeps> = {}): void {
  const { createElement, createObjectURL, revokeObjectURL } = { ...defaultDeps, ...deps };
  const blob = new Blob([buildRosterTemplateCsv()], { type: 'text/csv' });
  const url = createObjectURL(blob);
  const anchor = createElement('a') as HTMLAnchorElement;
  anchor.href = url;
  anchor.download = 'roster-template.csv';
  anchor.click();
  revokeObjectURL(url);
}
```

**Step 4 — Run it; expect PASS.**

```
npx vitest run src/roster/downloadRosterTemplate.test.ts
```

Expected: both tests green.

**Step 5 — Commit.**

```
git add src/roster/downloadRosterTemplate.ts src/roster/downloadRosterTemplate.test.ts
git commit -m "Add downloadRosterTemplate: Blob download of the roster CSV template"
```

---

### Task R3: Paste-list parser (`parsePastedRoster`)

A function that turns free-form pasted text (one student per line, `Name, email` or `Name <tab/comma> email`) into the same `ParseResult` shape `parseRoster` already returns, so the page can drive `ImportPreview` identically for pasted input. It normalizes pasted rows into a CSV with a known header and delegates all validation/dedup to the existing `parseRoster` — no new validation logic.

**Step 1 — Write the failing test (REAL code).**

Create `src/roster/parsePastedRoster.test.ts`:

```ts
// src/roster/parsePastedRoster.test.ts
import { describe, it, expect } from 'vitest';
import { parsePastedRoster } from './parsePastedRoster';

describe('parsePastedRoster', () => {
  it('parses "Name, email" lines into students (delegating to parseRoster)', () => {
    const text = 'Ada Lovelace, ada@x.edu\nAlan Turing, alan@x.edu\n';
    const r = parsePastedRoster(text);
    expect(r.students).toEqual([
      { name: 'Ada Lovelace', email: 'ada@x.edu', period: '', sourceRow: 2 },
      { name: 'Alan Turing', email: 'alan@x.edu', period: '', sourceRow: 3 },
    ]);
    expect(r.skipped).toEqual([]);
    expect(r.duplicates).toEqual([]);
  });

  it('accepts tab-separated and multi-space-separated lines too', () => {
    const text = 'Ada Lovelace\tada@x.edu\nAlan Turing   alan@x.edu';
    const r = parsePastedRoster(text);
    expect(r.students.map((s) => s.email)).toEqual(['ada@x.edu', 'alan@x.edu']);
  });

  it('ignores blank lines and trims surrounding whitespace', () => {
    const text = '\n  Ada Lovelace, ada@x.edu  \n\n';
    const r = parsePastedRoster(text);
    expect(r.students).toEqual([
      { name: 'Ada Lovelace', email: 'ada@x.edu', period: '', sourceRow: 2 },
    ]);
  });

  it('surfaces a bad line as a skipped row (reusing parseRoster validation)', () => {
    const text = 'Ada Lovelace, ada@x.edu\nNo Email Here,';
    const r = parsePastedRoster(text);
    expect(r.students.map((s) => s.name)).toEqual(['Ada Lovelace']);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].reason).toBe('Missing email');
  });

  it('returns an all-empty result for blank input', () => {
    const r = parsePastedRoster('   \n  ');
    expect(r.students).toEqual([]);
    expect(r.skipped).toEqual([]);
  });
});
```

**Step 2 — Run it; expect FAIL.**

```
npx vitest run src/roster/parsePastedRoster.test.ts
```

Expected: fails to resolve `./parsePastedRoster`.

**Step 3 — Minimal implementation (REAL code).**

Create `src/roster/parsePastedRoster.ts`:

```ts
// src/roster/parsePastedRoster.ts
import { parseRoster } from './parseRoster';
import { EMPTY_PARSE_RESULT, type ParseResult } from './types';

/**
 * Split one pasted line into [name, email]. Supports the common separators teachers
 * paste from spreadsheets/email: a comma, a tab, or a run of 2+ spaces between the
 * name and the email. Falls back to the last whitespace-delimited token as the email.
 */
function splitLine(line: string): [string, string] {
  const trimmed = line.trim();
  if (trimmed.includes(',')) {
    const idx = trimmed.indexOf(',');
    return [trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1).trim()];
  }
  if (trimmed.includes('\t')) {
    const idx = trimmed.indexOf('\t');
    return [trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1).trim()];
  }
  const multiSpace = trimmed.match(/^(.*?)\s{2,}(\S+)$/);
  if (multiSpace) return [multiSpace[1].trim(), multiSpace[2].trim()];
  // Last single-space-delimited token as email, the rest as name.
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) return [trimmed, ''];
  return [trimmed.slice(0, lastSpace).trim(), trimmed.slice(lastSpace + 1).trim()];
}

/** Escape a value for inclusion in a CSV cell (quote if it contains a comma/quote). */
function csvCell(value: string): string {
  if (value.includes(',') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Parse free-form pasted roster text (one student per line, "Name, email" / tab / spaces)
 * into the same ParseResult shape parseRoster produces. Normalizes each line into a CSV row
 * under a known `name,email` header, then delegates ALL validation/dedup/skip reporting to
 * the existing parseRoster — no parallel validation logic. Blank input → an all-empty result.
 */
export function parsePastedRoster(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return EMPTY_PARSE_RESULT;

  const rows = lines.map((line) => {
    const [name, email] = splitLine(line);
    return `${csvCell(name)},${csvCell(email)}`;
  });

  const csv = `name,email\n${rows.join('\n')}\n`;
  return parseRoster(csv);
}
```

**Step 4 — Run it; expect PASS.**

```
npx vitest run src/roster/parsePastedRoster.test.ts
```

Expected: all five tests green.

**Step 5 — Commit.**

```
git add src/roster/parsePastedRoster.ts src/roster/parsePastedRoster.test.ts
git commit -m "Add parsePastedRoster: parse pasted Name,email text via parseRoster"
```

---

### Task R4: Manual single-student add form (`AddStudentForm`)

An isolated, callback-driven form (name + email + "Add student") used by the "Type manually" entry method. Validates the email with the same regex the importer uses, then calls `onAdd({ name, email })` and clears. Kept as its own tested component so the rebuilt RosterPage just wires it up.

**Step 1 — Write the failing test (REAL code).**

Create `src/roster/AddStudentForm.test.tsx`:

```tsx
// src/roster/AddStudentForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddStudentForm } from './AddStudentForm';

describe('AddStudentForm', () => {
  it('calls onAdd with the trimmed name and email, then clears the fields', () => {
    const onAdd = vi.fn();
    render(<AddStudentForm onAdd={onAdd} />);
    const name = screen.getByLabelText('Student name') as HTMLInputElement;
    const email = screen.getByLabelText('Student email') as HTMLInputElement;
    fireEvent.change(name, { target: { value: '  Ada Lovelace ' } });
    fireEvent.change(email, { target: { value: ' ada@x.edu ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add student' }));
    expect(onAdd).toHaveBeenCalledWith({ name: 'Ada Lovelace', email: 'ada@x.edu' });
    expect(name.value).toBe('');
    expect(email.value).toBe('');
  });

  it('rejects an invalid email and does not call onAdd', () => {
    const onAdd = vi.fn();
    render(<AddStudentForm onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText('Student name'), { target: { value: 'Bad Email' } });
    fireEvent.change(screen.getByLabelText('Student email'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add student' }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
  });

  it('rejects a blank name and does not call onAdd', () => {
    const onAdd = vi.fn();
    render(<AddStudentForm onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText('Student email'), { target: { value: 'ada@x.edu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add student' }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/name/i);
  });
});
```

**Step 2 — Run it; expect FAIL.**

```
npx vitest run src/roster/AddStudentForm.test.tsx
```

Expected: fails to resolve `./AddStudentForm`.

**Step 3 — Minimal implementation (REAL code).**

Create `src/roster/AddStudentForm.tsx`:

```tsx
// src/roster/AddStudentForm.tsx
import { useState } from 'react';
import { tokens, tealButtonStyle } from '../ui/theme';

/** Same email shape the roster importer validates with (src/roster/parseRoster.ts). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface NewStudentInput {
  name: string;
  email: string;
}

interface AddStudentFormProps {
  onAdd: (student: NewStudentInput) => void;
}

/**
 * The "Type manually" entry method: name + email + Add student. Validates that a name
 * is present and the email matches the importer's regex before calling onAdd, then
 * clears for the next entry. Fully callback-driven so it's testable with vi.fn().
 */
export function AddStudentForm({ onAdd }: AddStudentFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError('Enter a student name.');
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    onAdd({ name: trimmedName, email: trimmedEmail });
    setName('');
    setEmail('');
    setError(null);
  }

  return (
    <div
      className="add-student-form"
      style={{ display: 'flex', gap: tokens.space(1), alignItems: 'flex-end', flexWrap: 'wrap' }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', color: tokens.color.subtle }}>
        Student name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', color: tokens.color.subtle }}>
        Student email
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <button type="button" style={tealButtonStyle()} onClick={submit}>
        Add student
      </button>
      {error && (
        <p role="alert" style={{ color: tokens.color.danger, width: '100%', margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
```

**Step 4 — Run it; expect PASS.**

```
npx vitest run src/roster/AddStudentForm.test.tsx
```

Expected: all three tests green.

**Step 5 — Commit.**

```
git add src/roster/AddStudentForm.tsx src/roster/AddStudentForm.test.tsx
git commit -m "Add AddStudentForm: validated manual name+email entry for the roster"
```

---

### Task R5: Paste-a-list panel (`PasteRosterPanel`)

A textarea + "Parse & add" panel that runs `parsePastedRoster` on the textarea contents and hands the resulting `ParseResult` to the page (which shows the shared `ImportPreview`). Isolated and tested so RosterPage only wires it up.

**Step 1 — Write the failing test (REAL code).**

Create `src/roster/PasteRosterPanel.test.tsx`:

```tsx
// src/roster/PasteRosterPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PasteRosterPanel } from './PasteRosterPanel';

describe('PasteRosterPanel', () => {
  it('parses the pasted text and calls onParsed with the ParseResult', () => {
    const onParsed = vi.fn();
    render(<PasteRosterPanel onParsed={onParsed} />);
    fireEvent.change(screen.getByLabelText(/paste/i), {
      target: { value: 'Ada Lovelace, ada@x.edu\nAlan Turing, alan@x.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /parse & add/i }));
    expect(onParsed).toHaveBeenCalledTimes(1);
    const result = onParsed.mock.calls[0][0];
    expect(result.students.map((s: { email: string }) => s.email)).toEqual([
      'ada@x.edu',
      'alan@x.edu',
    ]);
  });

  it('does not call onParsed when the textarea is empty', () => {
    const onParsed = vi.fn();
    render(<PasteRosterPanel onParsed={onParsed} />);
    fireEvent.click(screen.getByRole('button', { name: /parse & add/i }));
    expect(onParsed).not.toHaveBeenCalled();
  });
});
```

**Step 2 — Run it; expect FAIL.**

```
npx vitest run src/roster/PasteRosterPanel.test.tsx
```

Expected: fails to resolve `./PasteRosterPanel`.

**Step 3 — Minimal implementation (REAL code).**

Create `src/roster/PasteRosterPanel.tsx`:

```tsx
// src/roster/PasteRosterPanel.tsx
import { useState } from 'react';
import { parsePastedRoster } from './parsePastedRoster';
import type { ParseResult } from './types';
import { tokens, tealButtonStyle } from '../ui/theme';

interface PasteRosterPanelProps {
  /** Called with the ParseResult so the page can render the shared ImportPreview. */
  onParsed: (result: ParseResult) => void;
}

/**
 * The "Paste a list" entry method: a textarea + "Parse & add". Runs parsePastedRoster
 * over the pasted rows and hands the ParseResult up so the page shows the same
 * ImportPreview used for CSV upload. No-ops on empty input.
 */
export function PasteRosterPanel({ onParsed }: PasteRosterPanelProps) {
  const [text, setText] = useState('');

  function handleParse() {
    if (!text.trim()) return;
    onParsed(parsePastedRoster(text));
  }

  return (
    <div className="paste-roster-panel">
      <label
        htmlFor="paste-roster"
        style={{ display: 'block', color: tokens.color.subtle, marginBottom: tokens.space(1) }}
      >
        Paste a list (one student per line: Name, email)
      </label>
      <textarea
        id="paste-roster"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        style={{ width: '100%', fontFamily: tokens.mono }}
        placeholder={'Ada Lovelace, ada@school.edu\nAlan Turing, alan@school.edu'}
      />
      <button
        type="button"
        style={{ ...tealButtonStyle(), marginTop: tokens.space(1) }}
        onClick={handleParse}
      >
        Parse & add
      </button>
    </div>
  );
}
```

**Step 4 — Run it; expect PASS.**

```
npx vitest run src/roster/PasteRosterPanel.test.tsx
```

Expected: both tests green.

**Step 5 — Commit.**

```
git add src/roster/PasteRosterPanel.tsx src/roster/PasteRosterPanel.test.tsx
git commit -m "Add PasteRosterPanel: textarea + Parse & add wired to parsePastedRoster"
```

---

### Task R6: Upload-CSV panel with Download-template (`UploadRosterPanel`)

The "Upload CSV" entry method: a "Download template" button (calls `downloadRosterTemplate`) and a file input that reads the chosen file and parses it with `parseRoster`, handing the `ParseResult` up. Isolated so the page wires the preview once for both CSV and paste.

**Step 1 — Write the failing test (REAL code).**

Create `src/roster/UploadRosterPanel.test.tsx`:

```tsx
// src/roster/UploadRosterPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UploadRosterPanel } from './UploadRosterPanel';

describe('UploadRosterPanel', () => {
  it('clicking "Download template" invokes the injected download fn', () => {
    const onDownloadTemplate = vi.fn();
    render(<UploadRosterPanel onParsed={vi.fn()} onDownloadTemplate={onDownloadTemplate} />);
    fireEvent.click(screen.getByRole('button', { name: /download template/i }));
    expect(onDownloadTemplate).toHaveBeenCalledTimes(1);
  });

  it('reading a chosen CSV file parses it and calls onParsed', async () => {
    const onParsed = vi.fn();
    render(<UploadRosterPanel onParsed={onParsed} onDownloadTemplate={vi.fn()} />);
    const input = screen.getByLabelText(/upload a csv/i) as HTMLInputElement;
    const file = new File(['name,email\nAda Lovelace,ada@x.edu\n'], 'roster.csv', {
      type: 'text/csv',
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onParsed).toHaveBeenCalledTimes(1));
    const result = onParsed.mock.calls[0][0];
    expect(result.students).toEqual([
      { name: 'Ada Lovelace', email: 'ada@x.edu', period: '', sourceRow: 2 },
    ]);
  });
});
```

**Step 2 — Run it; expect FAIL.**

```
npx vitest run src/roster/UploadRosterPanel.test.tsx
```

Expected: fails to resolve `./UploadRosterPanel`.

**Step 3 — Minimal implementation (REAL code).**

Create `src/roster/UploadRosterPanel.tsx`:

```tsx
// src/roster/UploadRosterPanel.tsx
import { type ChangeEvent } from 'react';
import { parseRoster } from './parseRoster';
import { downloadRosterTemplate } from './downloadRosterTemplate';
import type { ParseResult } from './types';
import { tokens, tealButtonStyle } from '../ui/theme';

interface UploadRosterPanelProps {
  /** Called with the ParseResult so the page can render the shared ImportPreview. */
  onParsed: (result: ParseResult) => void;
  /** Injectable for testing; defaults to the real Blob download. */
  onDownloadTemplate?: () => void;
}

/**
 * The "Upload CSV" entry method: a "Download template" button (Blob download of the
 * name,email template) plus a file input that reads the chosen file and runs the existing
 * messy-data-tolerant parseRoster, handing the ParseResult up so the page shows ImportPreview.
 */
export function UploadRosterPanel({
  onParsed,
  onDownloadTemplate = downloadRosterTemplate,
}: UploadRosterPanelProps) {
  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onParsed(parseRoster(String(reader.result ?? '')));
    reader.readAsText(file);
  }

  return (
    <div className="upload-roster-panel">
      <button
        type="button"
        style={{ ...tealButtonStyle(), marginBottom: tokens.space(1) }}
        onClick={onDownloadTemplate}
      >
        Download template
      </button>
      <div>
        <label htmlFor="roster-csv" style={{ display: 'block', color: tokens.color.subtle }}>
          Upload a CSV (name, email)
        </label>
        <input id="roster-csv" type="file" accept=".csv,text/csv" onChange={handleFile} />
      </div>
    </div>
  );
}
```

**Step 4 — Run it; expect PASS.**

```
npx vitest run src/roster/UploadRosterPanel.test.tsx
```

Expected: both tests green.

**Step 5 — Commit.**

```
git add src/roster/UploadRosterPanel.tsx src/roster/UploadRosterPanel.test.tsx
git commit -m "Add UploadRosterPanel: Download template + CSV file parse via parseRoster"
```

---

### Task R7: Rebuild `RosterPage` for a period (three cohesive entry methods)

Rebuild the page at `/course/:courseId/period/:periodId/roster`. It loads the period's roster on mount and shows all three entry methods together (Upload CSV via `UploadRosterPanel`, Type manually via `AddStudentForm`, Paste a list via `PasteRosterPanel`), routes both CSV and paste through the shared `ImportPreview`, renders the saved students in `RosterTable` (with edit/remove), and offers a "Start writing feedback →" link to the period's compose route. Data access is period-scoped and injected so the smoke test drives it with mocks. Period-scoped data fns take `(db, uid, courseId, periodId, ...)`.

**Step 1 — Write the failing test (REAL code).**

Replace `src/pages/RosterPage.test.tsx` with:

```tsx
// src/pages/RosterPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { RosterStudent } from '../roster/RosterTable';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'teacher-1', email: 't@x.edu' } }),
}));

import { RosterPage } from './RosterPage';

const studentsInPeriod: RosterStudent[] = [
  { id: 's1', name: 'Ada Lovelace', email: 'ada@x.edu', period: 'Period 4' },
];

function makeDeps() {
  return {
    uid: 'teacher-1',
    listPeriodStudents: vi.fn(async () => studentsInPeriod),
    savePeriodStudents: vi.fn(async () => 1),
    updatePeriodStudent: vi.fn(async () => {}),
    deletePeriodStudent: vi.fn(async () => {}),
    downloadRosterTemplate: vi.fn(),
  };
}

function renderAt(deps: ReturnType<typeof makeDeps>) {
  return render(
    <MemoryRouter initialEntries={['/course/course-a/period/period-3/roster']}>
      <Routes>
        <Route
          path="/course/:courseId/period/:periodId/roster"
          element={<RosterPage deps={deps} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RosterPage (per period)', () => {
  it('loads the period roster from the route params on mount', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await waitFor(() =>
      expect(deps.listPeriodStudents).toHaveBeenCalledWith(
        { __fake: true },
        'teacher-1',
        'course-a',
        'period-3',
      ),
    );
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('shows all three entry methods together', async () => {
    const deps = makeDeps();
    renderAt(deps);
    expect(await screen.findByRole('button', { name: /download template/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add student' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /parse & add/i })).toBeInTheDocument();
  });

  it('"Download template" triggers the injected download fn', async () => {
    const deps = makeDeps();
    renderAt(deps);
    fireEvent.click(await screen.findByRole('button', { name: /download template/i }));
    expect(deps.downloadRosterTemplate).toHaveBeenCalledTimes(1);
  });

  it('manual add saves one student to the period then reloads', async () => {
    const deps = makeDeps();
    renderAt(deps);
    fireEvent.change(await screen.findByLabelText('Student name'), {
      target: { value: 'Grace Hopper' },
    });
    fireEvent.change(screen.getByLabelText('Student email'), {
      target: { value: 'grace@x.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add student' }));
    await waitFor(() =>
      expect(deps.savePeriodStudents).toHaveBeenCalledWith(
        { __fake: true },
        'teacher-1',
        'course-a',
        'period-3',
        [expect.objectContaining({ name: 'Grace Hopper', email: 'grace@x.edu' })],
      ),
    );
    // Reloads the roster after saving.
    expect(deps.listPeriodStudents).toHaveBeenCalledTimes(2);
  });

  it('paste → preview → confirm saves the parsed students to the period', async () => {
    const deps = makeDeps();
    renderAt(deps);
    fireEvent.change(await screen.findByLabelText(/paste/i), {
      target: { value: 'Grace Hopper, grace@x.edu\nKaty Bell, katy@x.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /parse & add/i }));
    // Shared ImportPreview appears with the found count, then confirm writes.
    fireEvent.click(await screen.findByRole('button', { name: /import 2 students/i }));
    await waitFor(() =>
      expect(deps.savePeriodStudents).toHaveBeenCalledWith(
        { __fake: true },
        'teacher-1',
        'course-a',
        'period-3',
        [
          expect.objectContaining({ name: 'Grace Hopper', email: 'grace@x.edu' }),
          expect.objectContaining({ name: 'Katy Bell', email: 'katy@x.edu' }),
        ],
      ),
    );
  });

  it('editing a student patches it under the period', async () => {
    const deps = makeDeps();
    renderAt(deps);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(deps.updatePeriodStudent).toHaveBeenCalledWith(
        { __fake: true },
        'teacher-1',
        'course-a',
        'period-3',
        's1',
        expect.objectContaining({ name: 'Ada Lovelace', email: 'ada@x.edu' }),
      ),
    );
  });

  it('shows a "Start writing feedback →" link to the period compose route', async () => {
    const deps = makeDeps();
    renderAt(deps);
    const link = await screen.findByRole('link', { name: /start writing feedback/i });
    expect(link).toHaveAttribute('href', '/course/course-a/period/period-3/compose');
  });
});
```

**Step 2 — Run it; expect FAIL.**

```
npx vitest run src/pages/RosterPage.test.tsx
```

Expected: fails — the current `RosterPage` is class-based (no `listPeriodStudents`/period route/three-panel UI), so these assertions do not pass.

**Step 3 — Minimal implementation (REAL code).**

Replace `src/pages/RosterPage.tsx` with:

```tsx
// src/pages/RosterPage.tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { listPeriodStudents } from '../data/listPeriodStudents';
import { savePeriodStudents } from '../data/savePeriodStudents';
import { updatePeriodStudent } from '../data/updatePeriodStudent';
import { deletePeriodStudent } from '../data/deletePeriodStudent';
import { downloadRosterTemplate } from '../roster/downloadRosterTemplate';
import { UploadRosterPanel } from '../roster/UploadRosterPanel';
import { AddStudentForm, type NewStudentInput } from '../roster/AddStudentForm';
import { PasteRosterPanel } from '../roster/PasteRosterPanel';
import { ImportPreview } from '../roster/ImportPreview';
import { RosterTable, type RosterStudent } from '../roster/RosterTable';
import type { StudentEditPatch } from '../roster/StudentRowActions';
import { EMPTY_PARSE_RESULT, type ParseResult } from '../roster/types';
import type { Student } from '../types';
import { tokens, panelStyle } from '../ui/theme';

/**
 * The per-period Roster screen at /course/:courseId/period/:periodId/roster.
 * Loads the period roster, offers three cohesive entry methods (Upload CSV with
 * template download, Type manually, Paste a list), routes CSV + paste through the
 * shared ImportPreview, renders RosterTable with edit/remove, and links to the
 * period's compose route. Period-scoped data fns + the template download are injected
 * so the smoke test drives it without a backend.
 */
export interface RosterPageDeps {
  uid: string;
  listPeriodStudents: typeof listPeriodStudents;
  savePeriodStudents: typeof savePeriodStudents;
  updatePeriodStudent: typeof updatePeriodStudent;
  deletePeriodStudent: typeof deletePeriodStudent;
  downloadRosterTemplate: typeof downloadRosterTemplate;
}

export function RosterPage({ deps }: { deps?: Partial<RosterPageDeps> }) {
  const { user } = useAuth();
  const { courseId = '', periodId = '' } = useParams();
  const uid = deps?.uid ?? user?.uid ?? '';
  const api = {
    listPeriodStudents: deps?.listPeriodStudents ?? listPeriodStudents,
    savePeriodStudents: deps?.savePeriodStudents ?? savePeriodStudents,
    updatePeriodStudent: deps?.updatePeriodStudent ?? updatePeriodStudent,
    deletePeriodStudent: deps?.deletePeriodStudent ?? deletePeriodStudent,
    downloadRosterTemplate: deps?.downloadRosterTemplate ?? downloadRosterTemplate,
  };

  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [preview, setPreview] = useState<ParseResult>(EMPTY_PARSE_RESULT);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reloadStudents() {
    try {
      setStudents(await api.listPeriodStudents(db, uid, courseId, periodId));
    } catch {
      setError('Could not load this period’s roster.');
    }
  }

  useEffect(() => {
    if (!uid || !courseId || !periodId) return;
    reloadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, courseId, periodId]);

  function handleParsed(result: ParseResult) {
    setPreview(result);
    setShowPreview(true);
  }

  async function persist(toSave: Student[]) {
    setError(null);
    try {
      await api.savePeriodStudents(db, uid, courseId, periodId, toSave);
      await reloadStudents();
    } catch {
      setError('Could not save the students.');
    }
  }

  async function handleConfirmImport() {
    const toSave: Student[] = preview.students.map((s, i) => ({
      id: `import-${i}`,
      name: s.name,
      email: s.email,
      period: s.period,
    }));
    await persist(toSave);
    setShowPreview(false);
  }

  async function handleAddManual(input: NewStudentInput) {
    await persist([{ id: 'manual-0', name: input.name, email: input.email, period: '' }]);
  }

  async function handleEditStudent(studentId: string, patch: StudentEditPatch) {
    await api.updatePeriodStudent(db, uid, courseId, periodId, studentId, patch);
    await reloadStudents();
  }

  async function handleRemoveStudent(studentId: string) {
    await api.deletePeriodStudent(db, uid, courseId, periodId, studentId);
    await reloadStudents();
  }

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: tokens.space(4) }}>
      <h1 style={{ color: tokens.color.text }}>Build the roster</h1>
      {error && (
        <p role="alert" style={{ color: tokens.color.danger }}>
          {error}
        </p>
      )}

      {!showPreview && (
        <div style={{ display: 'grid', gap: tokens.space(2) }}>
          <section aria-label="Upload CSV" style={panelStyle()}>
            <h2 style={{ color: tokens.color.text }}>Upload CSV</h2>
            <UploadRosterPanel
              onParsed={handleParsed}
              onDownloadTemplate={api.downloadRosterTemplate}
            />
          </section>

          <section aria-label="Type manually" style={panelStyle()}>
            <h2 style={{ color: tokens.color.text }}>Type manually</h2>
            <AddStudentForm onAdd={handleAddManual} />
          </section>

          <section aria-label="Paste a list" style={panelStyle()}>
            <h2 style={{ color: tokens.color.text }}>Paste a list</h2>
            <PasteRosterPanel onParsed={handleParsed} />
          </section>

          <section aria-label="Current roster" style={panelStyle()}>
            <h2 style={{ color: tokens.color.text }}>Current roster</h2>
            <RosterTable
              students={students}
              onEditStudent={handleEditStudent}
              onRemoveStudent={handleRemoveStudent}
            />
            <p style={{ marginTop: tokens.space(2) }}>
              <Link to={`/course/${courseId}/period/${periodId}/compose`}>
                Start writing feedback →
              </Link>
            </p>
          </section>
        </div>
      )}

      {showPreview && (
        <ImportPreview
          result={preview}
          onConfirm={handleConfirmImport}
          onCancel={() => setShowPreview(false)}
        />
      )}
    </main>
  );
}
```

> Dependency note: this page imports period-scoped data fns built in the data-model phase —
> `listPeriodStudents`, `savePeriodStudents`, `updatePeriodStudent`, `deletePeriodStudent`, all
> `(db, uid, courseId, periodId, …)` against
> `teachers/{uid}/years/{yearId}/courses/{courseId}/periods/{periodId}/students`. If those modules
> are not yet present when this task runs, add thin period-scoped wrappers mirroring the existing
> class-scoped `saveStudents`/`updateStudent`/`deleteStudent`/`listStudents` (same DI shape, deeper
> path) so the imports resolve. The smoke test injects mocks, so the page logic is verified
> independently of those modules.

**Step 4 — Run it; expect PASS.**

```
npx vitest run src/pages/RosterPage.test.tsx
```

Expected: all eight tests green.

**Step 5 — Commit.**

```
git add src/pages/RosterPage.tsx src/pages/RosterPage.test.tsx
git commit -m "Rebuild RosterPage per period with 3 cohesive entry methods + compose link"
```

---

### Task R8: Point the route at the per-period RosterPage

Update the route table so `/course/:courseId/period/:periodId/roster` renders the rebuilt `RosterPage`, replacing the old `/roster` entry. A routing smoke test confirms the period URL mounts the page and reads its params.

**Step 1 — Write the failing test (REAL code).**

Create `src/AppRoutes.roster.test.tsx`:

```tsx
// src/AppRoutes.roster.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./firebase/config', () => ({ db: { __fake: true } }));
vi.mock('./auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'teacher-1', email: 't@x.edu' } }),
}));
// Keep the smoke test focused on routing: stub the period data fns the page calls on mount.
vi.mock('./data/listPeriodStudents', () => ({ listPeriodStudents: vi.fn(async () => []) }));
vi.mock('./data/savePeriodStudents', () => ({ savePeriodStudents: vi.fn(async () => 0) }));
vi.mock('./data/updatePeriodStudent', () => ({ updatePeriodStudent: vi.fn(async () => {}) }));
vi.mock('./data/deletePeriodStudent', () => ({ deletePeriodStudent: vi.fn(async () => {}) }));

import { AppRoutes } from './App';

describe('AppRoutes — per-period roster route', () => {
  it('mounts RosterPage at /course/:courseId/period/:periodId/roster', async () => {
    render(
      <MemoryRouter initialEntries={['/course/course-a/period/period-3/roster']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /build the roster/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download template/i })).toBeInTheDocument();
  });
});
```

**Step 2 — Run it; expect FAIL.**

```
npx vitest run src/AppRoutes.roster.test.tsx
```

Expected: fails — no route matches the period URL (current table only has `/roster`), so the heading is never rendered.

**Step 3 — Minimal implementation (REAL code).**

Read the current route table first, then update it. Replace the existing `/roster` `<Route>` in `src/App.tsx` with the per-period route. The relevant edit:

```tsx
// In src/App.tsx — replace the old "/roster" Route with:
      <Route
        path="/course/:courseId/period/:periodId/roster"
        element={
          <RequireAuth>
            <RosterPage />
          </RequireAuth>
        }
      />
```

Keep the existing `RosterPage` import; preserve every other route (landing, compose, review, bank) and the `RequireAuth` wrapper exactly as they are. If a wrapper other than `RequireAuth` is used for protected routes in the current file, match that existing pattern rather than introducing a new one.

**Step 4 — Run it; expect PASS, then full suite.**

```
npx vitest run src/AppRoutes.roster.test.tsx
npx vitest run
```

Expected: the routing test passes and the whole suite stays green (note: any other test that navigated to the old `/roster` path is updated to the new period URL as part of this task).

**Step 5 — Commit.**

```
git add src/App.tsx src/AppRoutes.roster.test.tsx
git commit -m "Route /course/:courseId/period/:periodId/roster to the rebuilt RosterPage"
```

---

**Phase 3 notes for the assembler:**
- Tasks 1–6 are self-contained roster units (`src/roster/*`) with no cross-phase dependencies and can be built immediately.
- Task 7 (RosterPage rebuild) imports period-scoped data fns (`listPeriodStudents`, `savePeriodStudents`, `updatePeriodStudent`, `deletePeriodStudent`, `(db, uid, courseId, periodId, …)`) produced by the data-model phase; its smoke test injects mocks so the page is verified regardless. If those modules land in a later phase than this one, the inline dependency note in Task 7 says to add thin period-scoped wrappers mirroring the existing class-scoped data fns.
- Task 8 (routing) depends on Task 7 and on the compose route being the period URL `/course/:courseId/period/:periodId/compose` (compose re-pointing happens in the compose/send phase). The "Start writing feedback →" link already targets that URL.
- No file uses placeholders or "similar to Task N"; every step contains complete, runnable code. Types are imported from `src/types.ts`; no taxonomy import is needed in this phase (roster has no sentiment/grading-period logic).

Relevant files this phase creates or replaces (all absolute):
- `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/roster/rosterTemplate.ts` (+ `.test.ts`)
- `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/roster/downloadRosterTemplate.ts` (+ `.test.ts`)
- `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/roster/parsePastedRoster.ts` (+ `.test.ts`)
- `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/roster/AddStudentForm.tsx` (+ `.test.tsx`)
- `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/roster/PasteRosterPanel.tsx` (+ `.test.tsx`)
- `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/roster/UploadRosterPanel.tsx` (+ `.test.tsx`)
- `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/pages/RosterPage.tsx` (+ `.test.tsx`, replaced)
- `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/App.tsx` (route edit) + `/Users/shiebenaderet/Documents/GitHub/feedback/.worktrees/feedback-app/src/AppRoutes.roster.test.tsx`

Reused unchanged: `src/roster/parseRoster.ts`, `src/roster/ImportPreview.tsx`, `src/roster/RosterTable.tsx`, `src/roster/StudentRowActions.tsx`, `src/roster/normalize.ts`, `src/ui/theme.ts`.

---

## Phase 4 — Compose/Send re-point + write history

### Task C1: Re-point `loadComposeData` to the period route

Re-point the compose loader from `classId` to the `{courseId, periodId}` pair so it reads students from the nested period path and returns the tree ids that history will need.

**Step 1 — Write the failing test (REAL code).**

Replace `src/pages/loadComposeData.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest';
import { loadComposeData } from './loadComposeData';

describe('loadComposeData (period route)', () => {
  it('loads the period roster, bank, and tree ids for a course/period pair', async () => {
    const db = { __fake: true } as any;
    const deps = {
      listPeriods: vi.fn(async () => [
        { id: 'p4', label: 'Period 4', order: 4, courseId: 'co1', yearId: 'y1' },
        { id: 'p5', label: 'Period 5', order: 5, courseId: 'co1', yearId: 'y1' },
      ]),
      listPeriodStudents: vi.fn(async () => [
        { id: 's1', name: 'Ana', email: 'a@x.edu', period: 'Period 4' },
      ]),
      listBankEntries: vi.fn(async () => [
        { id: 'e1', templateText: 'Great work {name}', slots: [], tags: { area: 'cer', type: 'success' } },
      ]),
    };

    const data = await loadComposeData(db, 'u1', { courseId: 'co1', periodId: 'p4' }, deps as any);

    expect(deps.listPeriods).toHaveBeenCalledWith(db, 'u1', 'co1');
    expect(deps.listPeriodStudents).toHaveBeenCalledWith(db, 'u1', 'co1', 'p4');
    expect(deps.listBankEntries).toHaveBeenCalledWith(db, 'u1');
    expect(data.period).toEqual({ id: 'p4', label: 'Period 4', order: 4, courseId: 'co1', yearId: 'y1' });
    expect(data.courseId).toBe('co1');
    expect(data.yearId).toBe('y1');
    expect(data.students).toHaveLength(1);
    expect(data.entries[0].id).toBe('e1');
  });

  it('throws when the period id is not found under the course', async () => {
    const db = { __fake: true } as any;
    const deps = {
      listPeriods: vi.fn(async () => []),
      listPeriodStudents: vi.fn(async () => []),
      listBankEntries: vi.fn(async () => []),
    };
    await expect(
      loadComposeData(db, 'u1', { courseId: 'co1', periodId: 'nope' }, deps as any),
    ).rejects.toThrow('Period not found: nope');
  });
});
```

**Step 2 — Run, expect FAIL.**

```
npm run test -- src/pages/loadComposeData.test.ts
```
Expect failure: the current `loadComposeData` takes `classId` and returns `classMeta`, so the new signature/shape does not exist.

**Step 3 — Minimal implementation (REAL code).**

Replace `src/pages/loadComposeData.ts` with:

```ts
import type { Firestore } from 'firebase/firestore';
import type { BankEntry, Period } from '../types';
import type { RosterStudent } from '../roster/RosterTable';
import { listPeriods } from '../data/listPeriods';
import { listPeriodStudents } from '../data/listPeriodStudents';
import { listBankEntries } from '../bank/bankRepo';

export interface ComposeTarget {
  courseId: string;
  periodId: string;
}

export interface ComposeData {
  period: Period;
  courseId: string;
  yearId: string;
  students: RosterStudent[];
  entries: BankEntry[];
}

export interface LoadComposeDeps {
  listPeriods: typeof listPeriods;
  listPeriodStudents: typeof listPeriodStudents;
  // Structural signature so both the real bank-repo (bank-local BankEntry ⊆
  // canonical) and test mocks satisfy it.
  listBankEntries: (db: Firestore, uid: string) => Promise<BankEntry[]>;
}

const defaultDeps: LoadComposeDeps = {
  listPeriods,
  listPeriodStudents,
  listBankEntries: listBankEntries as LoadComposeDeps['listBankEntries'],
};

/**
 * Loads everything ComposePage needs for ONE period in one shot. Resolves the
 * Period (and its denormalized yearId) from listPeriods, the roster from the
 * nested period path, and the one shared bank. Bank entries from bankRepo are
 * structurally the canonical BankEntry, so they flow straight into ComposeScreen.
 */
export async function loadComposeData(
  db: Firestore,
  uid: string,
  target: ComposeTarget,
  deps: LoadComposeDeps = defaultDeps,
): Promise<ComposeData> {
  const { courseId, periodId } = target;
  const [periods, students, entries] = await Promise.all([
    deps.listPeriods(db, uid, courseId),
    deps.listPeriodStudents(db, uid, courseId, periodId),
    deps.listBankEntries(db, uid),
  ]);
  const period = periods.find((p) => p.id === periodId);
  if (!period) throw new Error(`Period not found: ${periodId}`);
  return {
    period,
    courseId,
    yearId: period.yearId,
    students,
    entries: entries as BankEntry[],
  };
}
```

> Note: `Period` here is assumed to carry denormalized `courseId`/`yearId` (set when the period was created in Phase 1). If your `Period` type is `{id,label,order}` only, have `listPeriods` return them denormalized, or pass `yearId` into `loadComposeData` from the route — reconcile at assembly.

**Step 4 — Run, expect PASS.**

```
npm run test -- src/pages/loadComposeData.test.ts
```

**Step 5 — Commit.**

```
git add src/pages/loadComposeData.ts src/pages/loadComposeData.test.ts
git commit -m "Re-point loadComposeData to the period route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C2: Re-point `ComposePage` to the period route and stamp `periodId`/`courseId`/`yearId` on the batch

`ComposePage` reads `:courseId`/`:periodId` from the route, calls the new `loadComposeData`, and creates the batch with the period tree ids instead of `classId`.

**Step 1 — Write the failing test (REAL code).**

Replace `src/pages/ComposePage.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } }),
}));

import { ComposePage } from './ComposePage';

function makeDeps() {
  return {
    loadComposeData: vi.fn(async () => ({
      period: { id: 'p4', label: 'Period 4', order: 4, courseId: 'co1', yearId: 'y1' },
      courseId: 'co1',
      yearId: 'y1',
      students: [
        { id: 's1', name: 'Ana', email: 'a@x.edu', period: 'Period 4' },
        { id: 's2', name: 'Ben', email: 'b@x.edu', period: 'Period 4' },
      ],
      entries: [{ id: 'e1', templateText: 'Great work {name}', slots: [], tags: {} }],
    })),
    createBatch: vi.fn(async () => 'batch-1'),
    updateBatch: vi.fn(async () => undefined),
    saveMessageDraft: vi.fn(async () => undefined),
  };
}

function renderAt(deps: ReturnType<typeof makeDeps>) {
  return render(
    <MemoryRouter initialEntries={['/course/co1/period/p4/compose']}>
      <Routes>
        <Route
          path="/course/:courseId/period/:periodId/compose"
          element={<ComposePage deps={deps} />}
        />
        <Route path="/review/:batchId" element={<div>review page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ComposePage (period route)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads period data and creates exactly one batch stamped with the tree ids', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText("Ana's message");
    expect(deps.loadComposeData).toHaveBeenCalledWith({ __fake: true }, 'u1', {
      courseId: 'co1',
      periodId: 'p4',
    });
    await waitFor(() =>
      expect(deps.createBatch).toHaveBeenCalledWith({ __fake: true }, 'u1', {
        periodId: 'p4',
        courseId: 'co1',
        yearId: 'y1',
        sharedHeader: '',
      }),
    );
    expect(deps.createBatch).toHaveBeenCalledTimes(1);
  });

  it('shows the period name in the heading', async () => {
    const deps = makeDeps();
    renderAt(deps);
    expect(await screen.findByText(/Period 4/)).toBeInTheDocument();
  });

  it('auto-save persists a draft to the created batch', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText("Ana's message");
    fireEvent.click(await screen.findByTestId('add-e1'));
    await waitFor(
      () =>
        expect(deps.saveMessageDraft).toHaveBeenCalledWith(
          { __fake: true },
          'u1',
          'batch-1',
          expect.objectContaining({ studentId: 's1', status: 'draft' }),
        ),
      { timeout: 2000 },
    );
  });
});
```

**Step 2 — Run, expect FAIL.**

```
npm run test -- src/pages/ComposePage.test.tsx
```
Expect failure: the page still reads `:classId`, calls `loadComposeData(db, uid, classId)`, and creates the batch with `{classId, sharedHeader}`.

**Step 3 — Minimal implementation (REAL code).**

Replace `src/pages/ComposePage.tsx` with:

```tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { createBatch, updateBatch } from '../firebase/batches';
import { saveMessageDraft } from '../firebase/messages';
import { loadComposeData, type ComposeData } from './loadComposeData';
import { ComposeScreen } from '../compose/ComposeScreen';
import { rosterProgress } from '../compose/rosterProgress';
import { nextStudentIndex } from '../compose/nextStudentIndex';
import type { ClassMeta, MessageDraft } from '../types';
import { tokens } from '../ui/theme';

export interface ComposePageDeps {
  uid: string;
  loadComposeData: typeof loadComposeData;
  createBatch: typeof createBatch;
  updateBatch: typeof updateBatch;
  saveMessageDraft: typeof saveMessageDraft;
}

export function ComposePage({ deps }: { deps?: Partial<ComposePageDeps> }) {
  const { courseId = '', periodId = '' } = useParams();
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const api = {
    loadComposeData: deps?.loadComposeData ?? loadComposeData,
    createBatch: deps?.createBatch ?? createBatch,
    updateBatch: deps?.updateBatch ?? updateBatch,
    saveMessageDraft: deps?.saveMessageDraft ?? saveMessageDraft,
  };

  const [data, setData] = useState<ComposeData | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [sharedHeader, setSharedHeader] = useState('');
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, MessageDraft>>({});
  const [error, setError] = useState<string | null>(null);

  // createBatch must run EXACTLY once; this guard survives StrictMode double-invoke.
  const batchStarted = useRef(false);
  const headerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!uid || !courseId || !periodId) return;
    let alive = true;
    api
      .loadComposeData(db, uid, { courseId, periodId })
      .then((d) => {
        if (!alive) return;
        setData(d);
        if (!batchStarted.current) {
          batchStarted.current = true;
          api
            .createBatch(db, uid, {
              periodId,
              courseId: d.courseId,
              yearId: d.yearId,
              sharedHeader: '',
            })
            .then((id) => {
              if (alive) setBatchId(id);
            });
        }
      })
      .catch(() => alive && setError('Could not load this period.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, courseId, periodId]);

  // Persist the shared header to the batch (debounced) so it isn't lost at review.
  const onHeaderChange = useCallback(
    (value: string) => {
      setSharedHeader(value);
      if (!batchId) return;
      if (headerTimer.current) clearTimeout(headerTimer.current);
      headerTimer.current = setTimeout(() => {
        void api.updateBatch(db, uid, batchId, { sharedHeader: value });
      }, 600);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, batchId],
  );

  const onAutoSave = useCallback(
    (bId: string, draft: MessageDraft) => {
      setDrafts((prev) => ({ ...prev, [draft.studentId]: draft }));
      void api.saveMessageDraft(db, uid, bId, draft);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid],
  );

  if (error)
    return (
      <main style={{ maxWidth: 1180, margin: ' 0 auto', padding: tokens.space(4) }}>
        <p role="alert">{error}</p>
      </main>
    );
  if (!data || !batchId)
    return (
      <main>
        <p>Loading…</p>
      </main>
    );

  const student = data.students[index];
  const progress = rosterProgress(
    data.students,
    Object.values(drafts).map((d) => ({
      studentId: d.studentId,
      finalText: d.finalText,
      status: d.status,
    })),
  );

  // ComposeScreen's classMeta is the slot-fill context; the period stands in for it.
  const classMeta: ClassMeta = { id: data.period.id, name: data.period.label };

  return (
    <main>
      <h1>Write feedback · {data.period.label}</h1>

      <label htmlFor="shared-header">Shared header (top of every message)</label>
      <textarea
        id="shared-header"
        value={sharedHeader}
        onChange={(e) => onHeaderChange(e.target.value)}
      />

      <div style={{ display: 'flex', gap: 16 }}>
        <nav aria-label="Roster" style={{ flex: '0 0 200px' }}>
          <p data-testid="roster-progress">
            {progress.doneCount} / {progress.total}
          </p>
          <ul>
            {data.students.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={i === index}
                  onClick={() => setIndex(i)}
                >
                  {s.name}
                  {progress.doneIds.has(s.id) ? ' ✓' : ''}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {student && (
          <ComposeScreen
            key={student.id}
            batchId={batchId}
            student={student}
            classMeta={classMeta}
            entries={data.entries}
            onAutoSave={onAutoSave}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setIndex((i) => nextStudentIndex(i, data.students.length))}
      >
        Save & next
      </button>

      {/* Compose → Review handoff. */}
      <Link to={`/review/${batchId}`}>Review & send →</Link>
    </main>
  );
}
```

**Step 4 — Run, expect PASS.**

```
npm run test -- src/pages/ComposePage.test.tsx
```

**Step 5 — Commit.**

```
git add src/pages/ComposePage.tsx src/pages/ComposePage.test.tsx
git commit -m "Re-point ComposePage to the period route and stamp tree ids on the batch

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C3: `GradingPeriodChooser` component (chooser + optional free-text label)

A small pre-send chooser: the fixed `GRADING_PERIODS` from the taxonomy as a select plus an optional free-text label. It is a controlled component, value lifted to the parent.

**Step 1 — Write the failing test (REAL code).**

Create `src/review/GradingPeriodChooser.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GradingPeriodChooser } from './GradingPeriodChooser';
import { GRADING_PERIODS } from '../feedback/taxonomy';

describe('GradingPeriodChooser', () => {
  it('renders one option per GRADING_PERIODS value', () => {
    render(
      <GradingPeriodChooser
        gradingPeriod={GRADING_PERIODS[0]}
        label=""
        onChange={vi.fn()}
      />,
    );
    const select = screen.getByLabelText(/grading period/i) as HTMLSelectElement;
    expect(select.options).toHaveLength(GRADING_PERIODS.length);
    for (const gp of GRADING_PERIODS) {
      expect(screen.getByRole('option', { name: gp })).toBeInTheDocument();
    }
  });

  it('reports the chosen grading period, preserving the label', () => {
    const onChange = vi.fn();
    render(
      <GradingPeriodChooser gradingPeriod="Q1" label="Unit 3" onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText(/grading period/i), {
      target: { value: 'Q2' },
    });
    expect(onChange).toHaveBeenCalledWith({ gradingPeriod: 'Q2', label: 'Unit 3' });
  });

  it('reports the typed label, preserving the grading period', () => {
    const onChange = vi.fn();
    render(<GradingPeriodChooser gradingPeriod="Q1" label="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/label/i), {
      target: { value: 'Unit 3 reflections' },
    });
    expect(onChange).toHaveBeenCalledWith({
      gradingPeriod: 'Q1',
      label: 'Unit 3 reflections',
    });
  });
});
```

**Step 2 — Run, expect FAIL.**

```
npm run test -- src/review/GradingPeriodChooser.test.tsx
```
Expect failure: the module does not exist.

**Step 3 — Minimal implementation (REAL code).**

Create `src/review/GradingPeriodChooser.tsx`:

```tsx
import { GRADING_PERIODS, type GradingPeriod } from '../feedback/taxonomy';
import { tokens } from '../ui/theme';

export interface GradingPeriodValue {
  gradingPeriod: GradingPeriod;
  label: string;
}

export interface GradingPeriodChooserProps {
  gradingPeriod: GradingPeriod;
  label: string;
  onChange: (value: GradingPeriodValue) => void;
}

/**
 * Pre-send chooser: which grading period this round belongs to (fixed
 * GRADING_PERIODS from the taxonomy) plus an optional free-text label
 * ('Unit 3 reflections'). The chosen value is stamped on the batch and on
 * every feedbackHistory entry written in this round.
 */
export function GradingPeriodChooser({
  gradingPeriod,
  label,
  onChange,
}: GradingPeriodChooserProps) {
  return (
    <fieldset
      style={{
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
        padding: tokens.space(2),
        display: 'flex',
        gap: tokens.space(2),
        alignItems: 'flex-end',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label htmlFor="grading-period">Grading period</label>
        <select
          id="grading-period"
          value={gradingPeriod}
          onChange={(e) =>
            onChange({ gradingPeriod: e.target.value as GradingPeriod, label })
          }
        >
          {GRADING_PERIODS.map((gp) => (
            <option key={gp} value={gp}>
              {gp}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <label htmlFor="grading-label">Label (optional)</label>
        <input
          id="grading-label"
          type="text"
          placeholder="e.g. Unit 3 reflections"
          value={label}
          onChange={(e) => onChange({ gradingPeriod, label: e.target.value })}
        />
      </div>
    </fieldset>
  );
}
```

**Step 4 — Run, expect PASS.**

```
npm run test -- src/review/GradingPeriodChooser.test.tsx
```

**Step 5 — Commit.**

```
git add src/review/GradingPeriodChooser.tsx src/review/GradingPeriodChooser.test.tsx
git commit -m "Add GradingPeriodChooser: pre-send grading-period + optional label

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C4: `deriveHistoryTags`: pure tag derivation from used bank entries

The core pure function. Given the used `BankEntry[]`, derive `{areas, sentiments, standards}` per the taxonomy: areas from each entry's `tags.area`, sentiments from `deriveSentiment(entry.tags.type)`, standards from a future `standard` tag (empty now). Deduped, order-stable. This is tested thoroughly.

**Step 1 — Write the failing test (REAL code).**

Create `src/feedback/deriveHistoryTags.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveHistoryTags } from './deriveHistoryTags';
import type { BankEntry } from '../types';

const entry = (id: string, tags: BankEntry['tags']): BankEntry => ({
  id,
  templateText: 't',
  slots: [],
  tags,
});

describe('deriveHistoryTags', () => {
  it('collects areas from each entry tags.area, deduped and order-stable', () => {
    const tags = deriveHistoryTags([
      entry('e1', { area: 'cer', type: 'success' }),
      entry('e2', { area: 'discussion', type: 'growth' }),
      entry('e3', { area: 'cer', type: 'success' }),
    ]);
    expect(tags.areas).toEqual(['cer', 'discussion']);
  });

  it('maps tags.type to sentiments via the taxonomy: success→strength, growth→growth', () => {
    const tags = deriveHistoryTags([
      entry('e1', { area: 'cer', type: 'success' }),
      entry('e2', { area: 'discussion', type: 'growth' }),
    ]);
    expect(tags.sentiments).toEqual(['strength', 'growth']);
  });

  it('maps behavior and skill types to neutral (not a strength/growth axis)', () => {
    const tags = deriveHistoryTags([
      entry('e1', { area: 'professionalism', type: 'behavior' }),
      entry('e2', { area: 'research', type: 'skill' }),
    ]);
    expect(tags.sentiments).toEqual(['neutral']);
  });

  it('dedupes sentiments across multiple entries of the same axis', () => {
    const tags = deriveHistoryTags([
      entry('e1', { area: 'cer', type: 'success' }),
      entry('e2', { area: 'discussion', type: 'success' }),
    ]);
    expect(tags.sentiments).toEqual(['strength']);
  });

  it('omits a missing area without inserting an empty string', () => {
    const tags = deriveHistoryTags([
      entry('e1', { type: 'success' }),
      entry('e2', { area: 'cer', type: 'growth' }),
    ]);
    expect(tags.areas).toEqual(['cer']);
  });

  it('skips entries whose type does not map to any sentiment', () => {
    const tags = deriveHistoryTags([
      entry('e1', { area: 'cer' }), // no type
      entry('e2', { area: 'discussion', type: 'success' }),
    ]);
    expect(tags.sentiments).toEqual(['strength']);
  });

  it('reads standards from a future standard tag, empty when none present', () => {
    const tags = deriveHistoryTags([entry('e1', { area: 'cer', type: 'success' })]);
    expect(tags.standards).toEqual([]);
  });

  it('collects standards from a (string[] or string) standard tag when present', () => {
    const tags = deriveHistoryTags([
      entry('e1', { area: 'cer', type: 'success', standard: 'RH.6-8.1' } as any),
      entry('e2', { area: 'cer', type: 'growth', standard: ['RH.6-8.2', 'RH.6-8.1'] } as any),
    ]);
    expect(tags.standards).toEqual(['RH.6-8.1', 'RH.6-8.2']);
  });

  it('returns empty arrays for no entries', () => {
    expect(deriveHistoryTags([])).toEqual({ areas: [], sentiments: [], standards: [] });
  });
});
```

**Step 2 — Run, expect FAIL.**

```
npm run test -- src/feedback/deriveHistoryTags.test.ts
```
Expect failure: the module does not exist.

**Step 3 — Minimal implementation (REAL code).**

Create `src/feedback/deriveHistoryTags.ts`:

```ts
import type { BankEntry, FeedbackHistoryEntry } from '../types';
import { deriveSentiment } from './taxonomy';

/** The derived, structured tag bundle stored on a feedbackHistory entry. */
export type DerivedTags = FeedbackHistoryEntry['tags'];

/** Push value(s) onto acc if not already present (order-stable dedupe). */
function pushUnique(acc: string[], value: unknown): void {
  if (value == null || value === '') return;
  if (Array.isArray(value)) {
    for (const v of value) pushUnique(acc, v);
    return;
  }
  const s = String(value);
  if (!acc.includes(s)) acc.push(s);
}

/**
 * Derive the structured history tags from the bank entries used in a message.
 *
 * - areas: each entry's tags.area, deduped, in first-seen order.
 * - sentiments: deriveSentiment(entry.tags.type) per the taxonomy
 *   (success→strength, growth→growth, behavior/skill→neutral), deduped.
 * - standards: a future 'standard' tag (string or string[]); empty today since
 *   seed entries carry no standard.
 *
 * Pure and synchronous — the raw usedEntries are stored alongside the result so
 * trends can be re-derived under a new taxonomy at any time.
 */
export function deriveHistoryTags(entries: BankEntry[]): DerivedTags {
  const areas: string[] = [];
  const sentiments: string[] = [];
  const standards: string[] = [];

  for (const e of entries) {
    pushUnique(areas, e.tags.area);

    const sentiment = e.tags.type ? deriveSentiment(e.tags.type) : undefined;
    pushUnique(sentiments, sentiment);

    // Future 'standard' tag — not yet in BankTags, read defensively.
    pushUnique(standards, (e.tags as { standard?: string | string[] }).standard);
  }

  return {
    areas,
    sentiments: sentiments as DerivedTags['sentiments'],
    standards,
  };
}
```

**Step 4 — Run, expect PASS.**

```
npm run test -- src/feedback/deriveHistoryTags.test.ts
```

**Step 5 — Commit.**

```
git add src/feedback/deriveHistoryTags.ts src/feedback/deriveHistoryTags.test.ts
git commit -m "Add deriveHistoryTags: pure area/sentiment/standard derivation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C5: `writeFeedbackHistory` data fn (DI-style, writes under the student)

Given a sent `MessageDraft`, the bank entries used, the batch's grading-period/label, and the tree ids, build a `FeedbackHistoryEntry` (deriving tags via `deriveHistoryTags`) and write it under the student's `feedbackHistory` subcollection. DI'd Firestore primitives, `vi.hoisted` mocks.

**Step 1 — Write the failing test (REAL code).**

Create `src/data/writeFeedbackHistory.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { writeFeedbackHistory } from './writeFeedbackHistory';
import type { BankEntry, MessageDraft } from '../types';

function makeBank(): BankEntry[] {
  return [
    { id: 'e1', templateText: 'Great work {name}', slots: [], tags: { area: 'cer', type: 'success' } },
    { id: 'e2', templateText: 'Speak up more', slots: [], tags: { area: 'discussion', type: 'growth' } },
    { id: 'e3', templateText: 'unused', slots: [], tags: { area: 'research', type: 'skill' } },
  ];
}

function makeDraft(): MessageDraft {
  return {
    studentId: 's1',
    name: 'Ana',
    usedEntries: ['e1', 'e2'],
    slotValues: {},
    finalText: 'Great work Ana. Speak up more.',
    status: 'sent',
  };
}

describe('writeFeedbackHistory', () => {
  it('writes a FeedbackHistoryEntry under the student with derived tags', async () => {
    const db = { __fake: true } as any;
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref: unknown, _data: unknown) => ({ id: 'h1' }));

    const id = await writeFeedbackHistory(
      db,
      'u1',
      {
        draft: makeDraft(),
        bankEntries: makeBank(),
        tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
        gradingPeriod: 'Q1',
        label: 'Unit 3',
        sentAt: 1718000000000,
      },
      { collection, addDoc } as any,
    );

    expect(id).toBe('h1');
    expect(collection).toHaveBeenCalledWith(
      db,
      'teachers/u1/years/y1/courses/co1/periods/p4/students/s1/feedbackHistory',
    );

    const written = addDoc.mock.calls[0][1] as any;
    expect(written).toMatchObject({
      studentId: 's1',
      periodId: 'p4',
      courseId: 'co1',
      yearId: 'y1',
      sentAt: 1718000000000,
      gradingPeriod: 'Q1',
      label: 'Unit 3',
      finalText: 'Great work Ana. Speak up more.',
      usedEntries: ['e1', 'e2'],
    });
    // tags derived only from the USED entries (e1, e2) — not the unused e3.
    expect(written.tags).toEqual({
      areas: ['cer', 'discussion'],
      sentiments: ['strength', 'growth'],
      standards: [],
    });
  });

  it('omits an empty label rather than writing label:""', async () => {
    const db = { __fake: true } as any;
    const collection = vi.fn(() => ({}));
    const addDoc = vi.fn(async () => ({ id: 'h2' }));

    await writeFeedbackHistory(
      db,
      'u1',
      {
        draft: makeDraft(),
        bankEntries: makeBank(),
        tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
        gradingPeriod: 'Q2',
        label: '',
        sentAt: 1,
      },
      { collection, addDoc } as any,
    );

    const written = addDoc.mock.calls[0][1] as any;
    expect('label' in written).toBe(false);
  });

  it('resolves used entries by id, ignoring used ids missing from the bank', async () => {
    const db = { __fake: true } as any;
    const collection = vi.fn(() => ({}));
    const addDoc = vi.fn(async () => ({ id: 'h3' }));

    const draft: MessageDraft = { ...makeDraft(), usedEntries: ['e1', 'ghost'] };
    await writeFeedbackHistory(
      db,
      'u1',
      {
        draft,
        bankEntries: makeBank(),
        tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
        gradingPeriod: 'Q1',
        label: '',
        sentAt: 1,
      },
      { collection, addDoc } as any,
    );

    const written = addDoc.mock.calls[0][1] as any;
    // 'ghost' is still recorded for traceability...
    expect(written.usedEntries).toEqual(['e1', 'ghost']);
    // ...but only the resolvable entry (e1) contributes derived tags.
    expect(written.tags.areas).toEqual(['cer']);
    expect(written.tags.sentiments).toEqual(['strength']);
  });
});
```

**Step 2 — Run, expect FAIL.**

```
npm run test -- src/data/writeFeedbackHistory.test.ts
```
Expect failure: the module does not exist.

**Step 3 — Minimal implementation (REAL code).**

Create `src/data/writeFeedbackHistory.ts`:

```ts
import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  type Firestore,
} from 'firebase/firestore';
import type { BankEntry, FeedbackHistoryEntry, MessageDraft } from '../types';
import type { GradingPeriod } from '../feedback/taxonomy';
import { deriveHistoryTags } from '../feedback/deriveHistoryTags';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface FirestoreWriteDeps {
  collection: typeof fbCollection;
  addDoc: typeof fbAddDoc;
}
const defaultDeps: FirestoreWriteDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
};

/** Location of the student in the year→course→period tree. */
export interface HistoryTree {
  yearId: string;
  courseId: string;
  periodId: string;
}

export interface WriteFeedbackHistoryArgs {
  /** The message as it was actually sent (status 'sent'). */
  draft: MessageDraft;
  /** The full bank (or at least the used entries), for tag derivation. */
  bankEntries: BankEntry[];
  tree: HistoryTree;
  gradingPeriod: GradingPeriod;
  /** Optional free-text label for the round; omitted from the doc when empty. */
  label: string;
  /** Timestamp (ms) the round went out; injected for deterministic tests. */
  sentAt: number;
}

/**
 * Write the DURABLE per-student feedback record. Independent of the batch:
 * called once per student on send / mark-sent. Derives structured tags from the
 * USED bank entries (taxonomy-driven) while storing the raw usedEntries ids so
 * trends are re-derivable under a future mapping.
 *
 * Path: teachers/{uid}/years/{yearId}/courses/{courseId}/periods/{periodId}
 *       /students/{studentId}/feedbackHistory/{entryId}
 *
 * Returns the generated history entry id.
 */
export async function writeFeedbackHistory(
  db: Firestore,
  uid: string,
  args: WriteFeedbackHistoryArgs,
  deps: FirestoreWriteDeps = defaultDeps,
): Promise<string> {
  const { collection, addDoc } = deps;
  const { draft, bankEntries, tree, gradingPeriod, label, sentAt } = args;

  const byId = new Map(bankEntries.map((e) => [e.id, e]));
  const usedEntries = byId.size ? draft.usedEntries.filter((id) => byId.has(id)) : [];
  const resolved = draft.usedEntries
    .map((id) => byId.get(id))
    .filter((e): e is BankEntry => !!e);

  const tags = deriveHistoryTags(resolved);

  const path = `teachers/${uid}/years/${tree.yearId}/courses/${tree.courseId}/periods/${tree.periodId}/students/${draft.studentId}/feedbackHistory`;

  const entry: FeedbackHistoryEntry = {
    studentId: draft.studentId,
    periodId: tree.periodId,
    courseId: tree.courseId,
    yearId: tree.yearId,
    sentAt,
    gradingPeriod,
    finalText: draft.finalText,
    tags,
    // Raw ids for traceability + reclassification (keep the unresolvable ones too).
    usedEntries: draft.usedEntries,
  };
  if (label) entry.label = label;

  // `usedEntries` (the filtered, in-bank subset) is intentionally unused as a
  // separate field — kept here only to make the resolve/skip path explicit.
  void usedEntries;

  const ref = await addDoc(collection(db, path), entry);
  return ref.id;
}
```

> The `void usedEntries` line is cosmetic; if your reviewer prefers, drop the `usedEntries`/`byId.size` lines entirely and keep only `resolved`. Either is fine — the test only asserts `entry.usedEntries === draft.usedEntries` and that tags derive from resolvable entries.

**Step 4 — Run, expect PASS.**

```
npm run test -- src/data/writeFeedbackHistory.test.ts
```

**Step 5 — Commit.**

```
git add src/data/writeFeedbackHistory.ts src/data/writeFeedbackHistory.test.ts
git commit -m "Add writeFeedbackHistory data fn: durable per-student record on send

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C6: `makeHistoryWriter`: per-message history sink bound to a batch's context

A thin factory that closes over `(db, uid, tree, gradingPeriod, label, bankEntries, sentAt)` and returns an `onSent(draft)` sink. This is the seam the send flow calls; it keeps `ReviewScreenContainer` free of Firestore/tree knowledge.

**Step 1 — Write the failing test (REAL code).**

Create `src/data/makeHistoryWriter.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeHistoryWriter } from './makeHistoryWriter';
import type { BankEntry, MessageDraft } from '../types';

const bank: BankEntry[] = [
  { id: 'e1', templateText: 'x', slots: [], tags: { area: 'cer', type: 'success' } },
];

const draft: MessageDraft = {
  studentId: 's1',
  name: 'Ana',
  usedEntries: ['e1'],
  slotValues: {},
  finalText: 'Hi Ana',
  status: 'sent',
};

describe('makeHistoryWriter', () => {
  it('returns a sink that calls writeFeedbackHistory with the bound context', async () => {
    const writeFeedbackHistory = vi.fn(async () => 'h1');
    const onSent = makeHistoryWriter({
      db: { __fake: true } as any,
      uid: 'u1',
      tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
      gradingPeriod: 'Q1',
      label: 'Unit 3',
      bankEntries: bank,
      now: () => 1718000000000,
      writeFeedbackHistory,
    });

    await onSent(draft);

    expect(writeFeedbackHistory).toHaveBeenCalledTimes(1);
    expect(writeFeedbackHistory).toHaveBeenCalledWith({ __fake: true }, 'u1', {
      draft,
      bankEntries: bank,
      tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
      gradingPeriod: 'Q1',
      label: 'Unit 3',
      sentAt: 1718000000000,
    });
  });

  it('does not throw to the caller if a history write fails (best-effort)', async () => {
    const writeFeedbackHistory = vi.fn(async () => {
      throw new Error('offline');
    });
    const onError = vi.fn();
    const onSent = makeHistoryWriter({
      db: {} as any,
      uid: 'u1',
      tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
      gradingPeriod: 'Q1',
      label: '',
      bankEntries: bank,
      now: () => 1,
      writeFeedbackHistory,
      onError,
    });

    await expect(onSent(draft)).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2 — Run, expect FAIL.**

```
npm run test -- src/data/makeHistoryWriter.test.ts
```
Expect failure: the module does not exist.

**Step 3 — Minimal implementation (REAL code).**

Create `src/data/makeHistoryWriter.ts`:

```ts
import type { Firestore } from 'firebase/firestore';
import type { BankEntry, MessageDraft } from '../types';
import type { GradingPeriod } from '../feedback/taxonomy';
import {
  writeFeedbackHistory as defaultWriteFeedbackHistory,
  type HistoryTree,
} from './writeFeedbackHistory';

/** A per-message sink the send flow calls after a student's message is sent. */
export type HistorySink = (draft: MessageDraft) => Promise<void>;

export interface MakeHistoryWriterArgs {
  db: Firestore;
  uid: string;
  tree: HistoryTree;
  gradingPeriod: GradingPeriod;
  label: string;
  bankEntries: BankEntry[];
  /** Clock seam; defaults to Date.now. */
  now?: () => number;
  /** Injected for tests; defaults to the real data fn. */
  writeFeedbackHistory?: typeof defaultWriteFeedbackHistory;
  /** Optional failure hook; history writing is best-effort and never blocks send. */
  onError?: (err: unknown, draft: MessageDraft) => void;
}

/**
 * Binds the immutable per-round context (tree ids, grading period, label, bank,
 * clock) into a single-arg sink. The send flow calls the sink once per sent
 * message; each call writes one durable feedbackHistory entry. Failures are
 * swallowed (reported via onError) so a history hiccup never breaks sending.
 */
export function makeHistoryWriter({
  db,
  uid,
  tree,
  gradingPeriod,
  label,
  bankEntries,
  now = Date.now,
  writeFeedbackHistory = defaultWriteFeedbackHistory,
  onError,
}: MakeHistoryWriterArgs): HistorySink {
  return async (draft: MessageDraft) => {
    try {
      await writeFeedbackHistory(db, uid, {
        draft,
        bankEntries,
        tree,
        gradingPeriod,
        label,
        sentAt: now(),
      });
    } catch (err) {
      onError?.(err, draft);
    }
  };
}
```

**Step 4 — Run, expect PASS.**

```
npm run test -- src/data/makeHistoryWriter.test.ts
```

**Step 5 — Commit.**

```
git add src/data/makeHistoryWriter.ts src/data/makeHistoryWriter.test.ts
git commit -m "Add makeHistoryWriter: per-message history sink bound to round context

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C7: Wire `onSent` into `ReviewScreenContainer` (Mode A progress + Mode B mark-sent)

`ReviewScreenContainer` gains an optional `onSent?: HistorySink`. In Mode A it fires `onSent` for each message as it resolves `sent`; in Mode B it fires `onSent` from the `SendStepper`'s `onMarkSent`/`onMarkAllSent`. Each sent message writes one history entry. `SendStepper` is reused unchanged.

**Step 1 — Write the failing test (REAL code).**

Append these tests to `src/review/ReviewScreenContainer.test.tsx` (inside the existing `describe`, after the Mode B test):

```tsx
  it('Mode A: fires onSent once per message that resolves as sent', async () => {
    const onSent = vi.fn(async () => {});
    const setBatchStatus = vi.fn(async () => {});
    const runSend = vi.fn(async (msgs: MessageDraft[], onProgress: (m: MessageDraft) => void) => {
      const sent = msgs.map((m) => ({ ...m, status: 'sent' as const }));
      sent.forEach(onProgress);
      return sent;
    });

    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="A"
        runSend={runSend}
        setBatchStatus={setBatchStatus}
        onSent={onSent}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /send all/i }));

    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(2));
    expect(onSent.mock.calls.map((c) => (c[0] as MessageDraft).studentId)).toEqual(['s1', 's2']);
    // failed messages must NOT write history.
  });

  it('Mode A: does not fire onSent for a message that failed', async () => {
    const onSent = vi.fn(async () => {});
    const runSend = vi.fn(async (msgs: MessageDraft[], onProgress: (m: MessageDraft) => void) => {
      const results = msgs.map((m, i) => ({ ...m, status: (i === 0 ? 'failed' : 'sent') as const }));
      results.forEach(onProgress);
      return results;
    });

    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="A"
        runSend={runSend}
        setBatchStatus={vi.fn(async () => {})}
        onSent={onSent}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /send all/i }));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect((onSent.mock.calls[0][0] as MessageDraft).studentId).toBe('s2');
  });

  it('Mode B: marking a student sent in the stepper writes that student to history', async () => {
    const onSent = vi.fn(async () => {});
    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="B"
        runSend={vi.fn()}
        setBatchStatus={vi.fn(async () => {})}
        onSent={onSent}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /send all/i }));
    await waitFor(() => expect(screen.getByTestId('copy-paste-panel')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /mark sent & next/i }));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect((onSent.mock.calls[0][0] as MessageDraft).studentId).toBe('s1');
  });

  it('Mode B: marking all sent writes every student exactly once', async () => {
    const onSent = vi.fn(async () => {});
    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="B"
        runSend={vi.fn()}
        setBatchStatus={vi.fn(async () => {})}
        onSent={onSent}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /send all/i }));
    await waitFor(() => expect(screen.getByTestId('copy-paste-panel')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /mark all sent/i }));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(2));
    expect(onSent.mock.calls.map((c) => (c[0] as MessageDraft).studentId).sort()).toEqual(['s1', 's2']);
  });

  it('Mode B: marking the same student sent twice writes history only once', async () => {
    const onSent = vi.fn(async () => {});
    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="B"
        runSend={vi.fn()}
        setBatchStatus={vi.fn(async () => {})}
        onSent={onSent}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /send all/i }));
    await waitFor(() => expect(screen.getByTestId('copy-paste-panel')).toBeTruthy());

    // mark s1 sent, advance, go back, mark s1 again — history must not double-write.
    fireEvent.click(screen.getByRole('button', { name: /mark sent & next/i })); // s1
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    fireEvent.click(screen.getByRole('button', { name: /mark sent & next/i })); // s1 again
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
  });
```

**Step 2 — Run, expect FAIL.**

```
npm run test -- src/review/ReviewScreenContainer.test.tsx
```
Expect failure: `ReviewScreenContainer` has no `onSent` prop and never invokes it.

**Step 3 — Minimal implementation (REAL code).**

Replace `src/review/ReviewScreenContainer.tsx` with:

```tsx
import { useState } from 'react';
import type { Batch, MessageDraft } from '../types';
import { ReviewScreen, type ReviewMessage } from './ReviewScreen';
import { type CopyPasteMessage } from '../send/CopyPastePanel';
import { SendStepper } from '../send/SendStepper';

export type SendMode = 'A' | 'B';

/** Mode A sender: sends each message, calling onProgress as each resolves. */
export type RunSend = (
  messages: MessageDraft[],
  onProgress: (m: MessageDraft) => void,
) => Promise<MessageDraft[]>;

/** Per-message history sink; fired once per student when their message is sent. */
export type OnSent = (draft: MessageDraft) => Promise<void> | void;

export interface ReviewScreenContainerProps {
  batch: Batch;
  messages: MessageDraft[];
  mode: SendMode;
  runSend: RunSend;
  setBatchStatus: (status: Batch['status']) => Promise<void> | void;
  /** Writes the durable feedbackHistory entry for each sent message. */
  onSent?: OnSent;
}

/** MessageDraft has no email; the container resolves it from a lookup if available. */
function toReviewMessages(drafts: MessageDraft[]): ReviewMessage[] {
  return drafts.map((d) => ({
    id: d.studentId,
    name: d.name,
    email: '',
    finalText: d.finalText,
  }));
}

function toCopyPasteMessages(
  drafts: MessageDraft[],
  sharedHeader: string,
): CopyPasteMessage[] {
  return drafts.map((d) => ({
    id: d.studentId,
    name: d.name,
    email: '',
    finalText: sharedHeader ? `${sharedHeader}\n\n${d.finalText}` : d.finalText,
  }));
}

/**
 * Owns the confirm → send orchestration above the leaf ReviewScreen list.
 * Mode A: setBatchStatus('sending') → runSend (feeding the live progress display)
 * → setBatchStatus('sent'); fires onSent for each message that resolved 'sent'.
 * Mode B: setBatchStatus('sending') → reveal the copy-paste panel; onSent fires
 * from the stepper's mark-sent. runSend/setBatchStatus/onSent/mode are injected
 * so this is testable without Firebase or Gmail.
 */
export function ReviewScreenContainer({
  batch,
  messages,
  mode,
  runSend,
  setBatchStatus,
  onSent,
}: ReviewScreenContainerProps) {
  const [results, setResults] = useState<MessageDraft[]>(messages);
  const [sending, setSending] = useState(false);
  const [showCopyPaste, setShowCopyPaste] = useState(false);
  const [sentInCopyPaste, setSentInCopyPaste] = useState<Record<string, boolean>>({});

  // Guards against double-writing history for a student already recorded.
  const [historyWritten, setHistoryWritten] = useState<Record<string, boolean>>({});

  function recordHistory(draft: MessageDraft) {
    if (!onSent) return;
    if (historyWritten[draft.studentId]) return;
    setHistoryWritten((prev) => ({ ...prev, [draft.studentId]: true }));
    void onSent(draft);
  }

  async function onConfirm() {
    // (1) Mark the batch in-flight FIRST, regardless of mode.
    await setBatchStatus('sending');

    if (mode === 'B') {
      setShowCopyPaste(true);
      return;
    }

    // Mode A: transmit, updating live results as each message resolves.
    setSending(true);
    const sent = await runSend(messages, (m) => {
      setResults((prev) => prev.map((r) => (r.studentId === m.studentId ? m : r)));
      if (m.status === 'sent') recordHistory(m);
    });
    setResults(sent);
    setSending(false);

    // (3) Only on completion does the batch flip to 'sent'.
    await setBatchStatus('sent');
  }

  function markSent(id: string) {
    setSentInCopyPaste((prev) => ({ ...prev, [id]: true }));
    const draft = results.find((r) => r.studentId === id);
    if (draft) recordHistory({ ...draft, status: 'sent' });
  }

  function markAllSent() {
    setSentInCopyPaste(Object.fromEntries(results.map((r) => [r.studentId, true])));
    for (const r of results) recordHistory({ ...r, status: 'sent' });
  }

  const sentCount = results.filter((r) => r.status === 'sent').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const showProgress =
    mode === 'A' && (sending || results.some((r) => r.status !== 'draft'));

  return (
    <div>
      <ReviewScreen messages={toReviewMessages(results)} onConfirm={onConfirm} />

      {showProgress && (
        <div role="status" aria-label="send progress">
          <span data-testid="progress-sent-count">{sentCount}</span> sent
          {failedCount > 0 && (
            <span data-testid="progress-failed-count"> · {failedCount} failed</span>
          )}
        </div>
      )}

      {mode === 'B' && showCopyPaste && (
        <div data-testid="copy-paste-panel">
          <SendStepper
            messages={toCopyPasteMessages(results, batch.sharedHeader)}
            sent={sentInCopyPaste}
            onMarkSent={markSent}
            onMarkAllSent={markAllSent}
          />
        </div>
      )}

      <button type="button" onClick={onConfirm}>
        Send all
      </button>
    </div>
  );
}
```

**Step 4 — Run, expect PASS** (and confirm no regression in the original two tests).

```
npm run test -- src/review/ReviewScreenContainer.test.tsx
```

**Step 5 — Commit.**

```
git add src/review/ReviewScreenContainer.tsx src/review/ReviewScreenContainer.test.tsx
git commit -m "Wire onSent history sink into ReviewScreenContainer (Mode A + Mode B)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C8: Build the `onSent` sink in `ReviewSendPage` from the batch + bank + grading-period chooser

`ReviewSendPage` loads the batch (now carrying `periodId/courseId/yearId/gradingPeriod/label`) and the bank, shows the `GradingPeriodChooser` (defaulting from the batch, persisting via `updateBatch`), constructs the `onSent` sink with `makeHistoryWriter`, and passes it to `ReviewScreenContainer`. Roster lookup moves to the period path.

**Step 1 — Write the failing test (REAL code).**

Create `src/pages/ReviewSendPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } }),
}));
vi.mock('../auth/gmailToken', () => ({ getGmailAccessToken: () => null })); // → Mode B

import { ReviewSendPage } from './ReviewSendPage';

function makeDeps() {
  return {
    getBatch: vi.fn(async () => ({
      id: 'b1',
      periodId: 'p4',
      courseId: 'co1',
      yearId: 'y1',
      sharedHeader: 'Hi',
      status: 'draft' as const,
      gradingPeriod: 'Q1' as const,
      label: '',
    })),
    listMessages: vi.fn(async () => [
      { studentId: 's1', name: 'Ana', usedEntries: ['e1'], slotValues: {}, finalText: 'Hi Ana', status: 'draft' as const },
    ]),
    listPeriodStudents: vi.fn(async () => [
      { id: 's1', name: 'Ana', email: 'a@x.edu', period: 'Period 4' },
    ]),
    listBankEntries: vi.fn(async () => [
      { id: 'e1', templateText: 'x', slots: [], tags: { area: 'cer', type: 'success' } },
    ]),
    setBatchStatus: vi.fn(async () => {}),
    updateBatch: vi.fn(async () => {}),
    writeFeedbackHistory: vi.fn(async () => 'h1'),
  };
}

function renderAt(deps: ReturnType<typeof makeDeps>) {
  return render(
    <MemoryRouter initialEntries={['/review/b1']}>
      <Routes>
        <Route path="/review/:batchId" element={<ReviewSendPage deps={deps} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReviewSendPage (history + grading period)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the batch, roster from the period path, and the bank', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByLabelText(/grading period/i);
    expect(deps.getBatch).toHaveBeenCalledWith({ __fake: true }, 'u1', 'b1');
    expect(deps.listPeriodStudents).toHaveBeenCalledWith({ __fake: true }, 'u1', 'co1', 'p4');
    expect(deps.listBankEntries).toHaveBeenCalledWith({ __fake: true }, 'u1');
  });

  it('defaults the grading-period chooser from the batch and persists changes', async () => {
    const deps = makeDeps();
    renderAt(deps);
    const select = (await screen.findByLabelText(/grading period/i)) as HTMLSelectElement;
    expect(select.value).toBe('Q1');
    fireEvent.change(select, { target: { value: 'Q2' } });
    await waitFor(() =>
      expect(deps.updateBatch).toHaveBeenCalledWith({ __fake: true }, 'u1', 'b1', {
        gradingPeriod: 'Q2',
        label: '',
      }),
    );
  });

  it('marking a student sent writes feedbackHistory with the batch context', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByLabelText(/grading period/i);
    fireEvent.click(screen.getByRole('button', { name: /send all/i }));
    await waitFor(() => expect(screen.getByTestId('copy-paste-panel')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /mark sent & next/i }));

    await waitFor(() => expect(deps.writeFeedbackHistory).toHaveBeenCalledTimes(1));
    const [, uid, args] = deps.writeFeedbackHistory.mock.calls[0];
    expect(uid).toBe('u1');
    expect(args).toMatchObject({
      tree: { yearId: 'y1', courseId: 'co1', periodId: 'p4' },
      gradingPeriod: 'Q1',
      label: '',
    });
    expect(args.draft.studentId).toBe('s1');
    expect(args.bankEntries).toHaveLength(1);
  });
});
```

**Step 2 — Run, expect FAIL.**

```
npm run test -- src/pages/ReviewSendPage.test.tsx
```
Expect failure: the page reads `b.classId`, has no grading-period chooser, no bank load, and no `onSent` wiring.

**Step 3 — Minimal implementation (REAL code).**

Replace `src/pages/ReviewSendPage.tsx` with:

```tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { getBatch, setBatchStatus, updateBatch } from '../firebase/batches';
import { listMessages } from '../firebase/messages';
import { listPeriodStudents } from '../data/listPeriodStudents';
import { listBankEntries } from '../bank/bankRepo';
import { writeFeedbackHistory } from '../data/writeFeedbackHistory';
import { makeHistoryWriter } from '../data/makeHistoryWriter';
import { getGmailAccessToken } from '../auth/gmailToken';
import { chooseSendMode } from '../send/chooseSendMode';
import { createGmailSender } from '../send/gmailSender';
import { makeRunSend } from '../send/makeRunSend';
import { ReviewScreenContainer } from '../review/ReviewScreenContainer';
import {
  GradingPeriodChooser,
  type GradingPeriodValue,
} from '../review/GradingPeriodChooser';
import { GRADING_PERIODS, type GradingPeriod } from '../feedback/taxonomy';
import type { Batch, BankEntry, MessageDraft } from '../types';
import type { GmailSender } from '../send/batchSendMachine';
import { tokens } from '../ui/theme';

const SUBJECT = 'Feedback on your work';

export interface ReviewSendPageDeps {
  uid: string;
  email: string;
  getBatch: typeof getBatch;
  listMessages: typeof listMessages;
  listPeriodStudents: typeof listPeriodStudents;
  listBankEntries: (db: unknown, uid: string) => Promise<BankEntry[]>;
  setBatchStatus: typeof setBatchStatus;
  updateBatch: typeof updateBatch;
  writeFeedbackHistory: typeof writeFeedbackHistory;
  /** Pre-built Gmail send fn; defaults to createGmailSender(...). Lets tests skip OAuth. */
  sendOne: GmailSender;
}

export function ReviewSendPage({ deps }: { deps?: Partial<ReviewSendPageDeps> }) {
  const { batchId = '' } = useParams();
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const email = deps?.email ?? user?.email ?? '';

  const api = {
    getBatch: deps?.getBatch ?? getBatch,
    listMessages: deps?.listMessages ?? listMessages,
    listPeriodStudents: deps?.listPeriodStudents ?? listPeriodStudents,
    listBankEntries:
      deps?.listBankEntries ?? (listBankEntries as ReviewSendPageDeps['listBankEntries']),
    setBatchStatus: deps?.setBatchStatus ?? setBatchStatus,
    updateBatch: deps?.updateBatch ?? updateBatch,
    writeFeedbackHistory: deps?.writeFeedbackHistory ?? writeFeedbackHistory,
  };

  const token = getGmailAccessToken();
  const mode = chooseSendMode({ gmailScopeGranted: !!token });

  const [batch, setBatch] = useState<Batch | null>(null);
  const [messages, setMessages] = useState<MessageDraft[]>([]);
  const [emailById, setEmailById] = useState<Record<string, string>>({});
  const [bankEntries, setBankEntries] = useState<BankEntry[]>([]);
  const [gp, setGp] = useState<GradingPeriodValue>({
    gradingPeriod: GRADING_PERIODS[0],
    label: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !batchId) return;
    let alive = true;
    (async () => {
      try {
        const b = await api.getBatch(db, uid, batchId);
        if (!b) throw new Error('Batch not found');
        const [msgs, roster, entries] = await Promise.all([
          api.listMessages(db, uid, batchId),
          api.listPeriodStudents(db, uid, b.courseId, b.periodId),
          api.listBankEntries(db, uid),
        ]);
        if (!alive) return;
        setBatch(b);
        setMessages(msgs);
        setEmailById(Object.fromEntries(roster.map((s) => [s.id, s.email])));
        setBankEntries(entries as BankEntry[]);
        setGp({
          gradingPeriod: (b.gradingPeriod ?? GRADING_PERIODS[0]) as GradingPeriod,
          label: b.label ?? '',
        });
      } catch {
        if (alive) setError('Could not load this batch.');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, batchId]);

  const onGpChange = useCallback(
    (value: GradingPeriodValue) => {
      setGp(value);
      void api.updateBatch(db, uid, batchId, {
        gradingPeriod: value.gradingPeriod,
        label: value.label,
      } as Partial<Batch>);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, batchId],
  );

  // Mode A sender: injected in tests, else the real Gmail sender from the token.
  const sendOne: GmailSender = useMemo(() => {
    if (deps?.sendOne) return deps.sendOne;
    return createGmailSender({ accessToken: token ?? '', from: email, subject: SUBJECT });
  }, [deps?.sendOne, token, email]);

  const runSend = useMemo(
    () => makeRunSend(sendOne, (id) => emailById[id] ?? ''),
    [sendOne, emailById],
  );

  const onSent = useMemo(() => {
    if (!batch) return undefined;
    return makeHistoryWriter({
      db,
      uid,
      tree: { yearId: batch.yearId, courseId: batch.courseId, periodId: batch.periodId },
      gradingPeriod: gp.gradingPeriod,
      label: gp.label,
      bankEntries,
      writeFeedbackHistory: api.writeFeedbackHistory,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch, uid, gp.gradingPeriod, gp.label, bankEntries]);

  if (error)
    return (
      <main style={{ maxWidth: 1180, margin: ' 0 auto', padding: tokens.space(4) }}>
        <p role="alert">{error}</p>
      </main>
    );
  if (!batch)
    return (
      <main>
        <p>Loading…</p>
      </main>
    );

  return (
    <main>
      <h1>Review & send · {batch.sharedHeader}</h1>

      <GradingPeriodChooser
        gradingPeriod={gp.gradingPeriod}
        label={gp.label}
        onChange={onGpChange}
      />

      <ReviewScreenContainer
        batch={batch}
        messages={messages}
        mode={mode}
        runSend={runSend}
        setBatchStatus={(status) =>
          api.setBatchStatus(db, uid, batchId, status as 'sending' | 'sent')
        }
        onSent={onSent}
      />
    </main>
  );
}
```

> This task imports `Batch` fields `yearId/courseId/periodId/gradingPeriod/label` from the Phase-1 type update. If `updateBatch`'s `patch` type is still narrowed to `Pick<Batch,'sharedHeader'>`, widen it in `src/firebase/batches.ts` to also accept `gradingPeriod`/`label` (a one-line `Partial<Pick<Batch,'sharedHeader'|'gradingPeriod'|'label'>>`) as part of this task and re-run `npm run test -- src/firebase` if those tests aren't emulator-gated.

**Step 4 — Run, expect PASS.**

```
npm run test -- src/pages/ReviewSendPage.test.tsx
```

**Step 5 — Commit.**

```
git add src/pages/ReviewSendPage.tsx src/pages/ReviewSendPage.test.tsx src/firebase/batches.ts
git commit -m "Wire grading-period chooser + history sink into ReviewSendPage

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C9: Full-suite green + route registration check

Confirm the whole default suite is green after re-pointing, and register the period-route paths in the router so the re-pointed pages are reachable.

**Step 1 — Write the failing test (REAL code).**

Add to `src/App.test.tsx` (inside the existing top-level `describe`; adjust the render helper name if `App.test.tsx` uses a different one — match its existing pattern):

```tsx
  it('routes the period-scoped compose path to ComposePage', () => {
    renderAppAt('/course/co1/period/p4/compose');
    // ComposePage renders its Loading… shell before data resolves.
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('routes /review/:batchId to ReviewSendPage', () => {
    renderAppAt('/review/b1');
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
```

> If `App.test.tsx` has no `renderAppAt(path)` helper, add one mirroring its existing render (wrap `<App />` in `<MemoryRouter initialEntries={[path]}>` if `App` doesn't own the router, else set `window.history` / use the project's existing harness). Keep it consistent with the file's current style.

**Step 2 — Run, expect FAIL.**

```
npm run test -- src/App.test.tsx
```
Expect failure: the router still registers `/compose/:classId` (and possibly a `classId`-based review path), so the period-scoped paths don't match.

**Step 3 — Minimal implementation (REAL code).**

In `src/App.tsx`, register the period-scoped routes (replace the old `/compose/:classId` route; keep everything else). The exact JSX depends on the existing `<Routes>` block — make these the registered paths:

```tsx
<Route
  path="/course/:courseId/period/:periodId/compose"
  element={<ComposePage />}
/>
<Route path="/review/:batchId" element={<ReviewSendPage />} />
```

Ensure `ComposePage` and `ReviewSendPage` are imported in `App.tsx` (they likely already are; update the import path only if the old route used a different component).

**Step 4 — Run the FULL default suite, expect PASS.**

```
npm run test
```
Expect all unit tests green (the emulator-gated `rules.test.ts`, `bankRules.test.ts`, `batches.test.ts`, `messages.test.ts` remain excluded per `vite.config.ts`). Then typecheck:

```
npm run build
```

**Step 5 — Commit.**

```
git add src/App.tsx src/App.test.tsx
git commit -m "Register period-scoped compose + review routes; full suite green

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for plan assembly

- **Cross-phase dependencies my tasks import (must exist before Phase 4 runs):** `src/feedback/taxonomy.ts` (`GRADING_PERIODS`, `GradingPeriod`, `deriveSentiment`); `src/types.ts` additions (`Period`, `FeedbackHistoryEntry`, and `Batch` gaining `periodId/courseId/yearId/gradingPeriod?/label?`); period-path data fns `src/data/listPeriods.ts` and `src/data/listPeriodStudents.ts`; and `createBatch` accepting `{periodId,courseId,yearId,sharedHeader}`. If an earlier phase named any of these differently, reconcile the imports in Tasks 1, 2, 5, 6, 8 at assembly.
- **`createBatch` signature** (Task 2 calls it with the tree ids) is owned by the Phase that re-points `src/firebase/batches.ts`. My ComposePage test mocks it, so Task 2 passes regardless; just ensure the real `createBatch` matches `{periodId, courseId, yearId, sharedHeader}` before integration.
- **Reused intact:** `SendStepper` (unchanged — Task 7 only changes the `onMarkSent`/`onMarkAllSent` handlers passed to it), `makeRunSend`, `chooseSendMode`, `createGmailSender`, `ComposeScreen`, `useComposeMessage`, `rosterProgress`, `nextStudentIndex`, `listBankEntries`.
- **Files created:** `src/review/GradingPeriodChooser.tsx`, `src/feedback/deriveHistoryTags.ts`, `src/data/writeFeedbackHistory.ts`, `src/data/makeHistoryWriter.ts` (+ tests). **Files rewritten:** `src/pages/loadComposeData.ts`, `src/pages/ComposePage.tsx`, `src/pages/ReviewSendPage.tsx`, `src/review/ReviewScreenContainer.tsx`, `src/App.tsx`. **Emulator-gated** rules/firebase tests stay excluded from `npm run test`.

---

## Phase 5 — History surfaces + Trends

### Task H1: `listStudentHistory` data fn (one student, chronological)

**Step 1 — Failing test (REAL code).** Create `src/data/listStudentHistory.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { listStudentHistory } from './listStudentHistory';
import type { FeedbackHistoryEntry } from '../types';

describe('listStudentHistory', () => {
  it('reads the student feedbackHistory subcollection ordered by sentAt desc and maps to FeedbackHistoryEntry[]', async () => {
    const db = { __fake: true };
    const uid = 'teacher-1';
    const loc = { yearId: 'y1', courseId: 'c1', periodId: 'p1', studentId: 's1' };

    const collection = vi.fn((_db: unknown, path: string) => ({ __coll: path }));
    const orderBy = vi.fn((field: string, dir: string) => ({ __orderBy: [field, dir] }));
    const query = vi.fn((coll: unknown, ...clauses: unknown[]) => ({ __query: { coll, clauses } }));
    const snapshot = {
      docs: [
        {
          id: 'h2',
          data: () => ({
            studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
            sentAt: 200, gradingPeriod: 'Q2', label: 'Quarter check-in',
            finalText: 'Strong quarter, Ada.',
            tags: { areas: ['cer'], sentiments: ['strength'], standards: ['argumentation'] },
            usedEntries: ['seed-cer-success-1'],
          }),
        },
        {
          id: 'h1',
          data: () => ({
            studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
            sentAt: 100, gradingPeriod: 'Q1',
            finalText: 'Welcome, Ada.',
            tags: { areas: ['discussion'], sentiments: ['growth'], standards: [] },
            usedEntries: ['seed-discussion-growth-1'],
          }),
        },
      ],
    };
    const getDocs = vi.fn(async () => snapshot);

    const result = await listStudentHistory(db as never, uid, loc, {
      collection, orderBy, query, getDocs,
    } as never);

    expect(collection).toHaveBeenCalledWith(
      db,
      'teachers/teacher-1/years/y1/courses/c1/periods/p1/students/s1/feedbackHistory',
    );
    expect(orderBy).toHaveBeenCalledWith('sentAt', 'desc');
    expect(query).toHaveBeenCalledWith({ __coll: expect.any(String) }, { __orderBy: ['sentAt', 'desc'] });
    expect(getDocs).toHaveBeenCalledWith({ __query: expect.anything() });

    const expected: FeedbackHistoryEntry[] = [
      {
        id: 'h2', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
        sentAt: 200, gradingPeriod: 'Q2', label: 'Quarter check-in',
        finalText: 'Strong quarter, Ada.',
        tags: { areas: ['cer'], sentiments: ['strength'], standards: ['argumentation'] },
        usedEntries: ['seed-cer-success-1'],
      },
      {
        id: 'h1', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
        sentAt: 100, gradingPeriod: 'Q1',
        finalText: 'Welcome, Ada.',
        tags: { areas: ['discussion'], sentiments: ['growth'], standards: [] },
        usedEntries: ['seed-discussion-growth-1'],
      },
    ];
    expect(result).toEqual(expected);
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/data/listStudentHistory.test.ts` → fails (module `./listStudentHistory` does not exist).

**Step 3 — Minimal impl (REAL code).** Create `src/data/listStudentHistory.ts`:

```ts
import {
  collection as fbCollection,
  getDocs as fbGetDocs,
  orderBy as fbOrderBy,
  query as fbQuery,
  type Firestore,
} from 'firebase/firestore';
import type { FeedbackHistoryEntry } from '../types';

export interface StudentLocation {
  yearId: string;
  courseId: string;
  periodId: string;
  studentId: string;
}

export interface HistoryReadDeps {
  collection: typeof fbCollection;
  getDocs: typeof fbGetDocs;
  orderBy: typeof fbOrderBy;
  query: typeof fbQuery;
}

const defaultDeps: HistoryReadDeps = {
  collection: fbCollection,
  getDocs: fbGetDocs,
  orderBy: fbOrderBy,
  query: fbQuery,
};

/** Path to one student's feedbackHistory subcollection under the new taxonomy paths. */
export function studentHistoryPath(uid: string, loc: StudentLocation): string {
  return `teachers/${uid}/years/${loc.yearId}/courses/${loc.courseId}/periods/${loc.periodId}/students/${loc.studentId}/feedbackHistory`;
}

/**
 * Reads one student's feedbackHistory entries, newest first.
 * Maps each doc id onto FeedbackHistoryEntry.id so callers have a stable key.
 */
export async function listStudentHistory(
  db: Firestore,
  uid: string,
  loc: StudentLocation,
  deps: HistoryReadDeps = defaultDeps,
): Promise<FeedbackHistoryEntry[]> {
  const { collection, getDocs, orderBy, query } = deps;
  const coll = collection(db, studentHistoryPath(uid, loc));
  const q = query(coll, orderBy('sentAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<FeedbackHistoryEntry, 'id'>),
  }));
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/data/listStudentHistory.test.ts` → green.

**Step 5 — Commit.** `git add src/data/listStudentHistory.ts src/data/listStudentHistory.test.ts && git commit -m "feat(history): listStudentHistory data fn (chronological per-student read)"`

---

### Task H2: `listPeriodHistory` data fn (all students in a period, for trends)

Trends need every history entry across a period/course, not one student. A collection-group read over `feedbackHistory` filtered by `periodId` is the analytics feed.

**Step 1 — Failing test (REAL code).** Create `src/data/listPeriodHistory.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { listPeriodHistory } from './listPeriodHistory';
import type { FeedbackHistoryEntry } from '../types';

describe('listPeriodHistory', () => {
  it('collection-group reads feedbackHistory filtered by uid + periodId', async () => {
    const db = { __fake: true };

    const collectionGroup = vi.fn((_db: unknown, id: string) => ({ __cg: id }));
    const where = vi.fn((f: string, op: string, v: unknown) => ({ __where: [f, op, v] }));
    const query = vi.fn((coll: unknown, ...clauses: unknown[]) => ({ __query: { coll, clauses } }));
    const snapshot = {
      docs: [
        {
          id: 'h1',
          data: () => ({
            studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
            sentAt: 100, gradingPeriod: 'Q1', finalText: 't1',
            tags: { areas: ['cer'], sentiments: ['strength'], standards: [] },
            usedEntries: ['seed-cer-success-1'],
          }),
        },
        {
          id: 'h2',
          data: () => ({
            studentId: 's2', periodId: 'p1', courseId: 'c1', yearId: 'y1',
            sentAt: 150, gradingPeriod: 'Q1', finalText: 't2',
            tags: { areas: ['discussion'], sentiments: ['growth'], standards: [] },
            usedEntries: ['seed-discussion-growth-1'],
          }),
        },
      ],
    };
    const getDocs = vi.fn(async () => snapshot);

    const result = await listPeriodHistory(db as never, 'teacher-1', 'p1', {
      collectionGroup, where, query, getDocs,
    } as never);

    expect(collectionGroup).toHaveBeenCalledWith(db, 'feedbackHistory');
    expect(where).toHaveBeenCalledWith('periodId', '==', 'p1');
    expect(query).toHaveBeenCalledWith({ __cg: 'feedbackHistory' }, { __where: ['periodId', '==', 'p1'] });
    expect(getDocs).toHaveBeenCalledWith({ __query: expect.anything() });

    const expected: FeedbackHistoryEntry[] = [
      { id: 'h1', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1', sentAt: 100, gradingPeriod: 'Q1', finalText: 't1', tags: { areas: ['cer'], sentiments: ['strength'], standards: [] }, usedEntries: ['seed-cer-success-1'] },
      { id: 'h2', studentId: 's2', periodId: 'p1', courseId: 'c1', yearId: 'y1', sentAt: 150, gradingPeriod: 'Q1', finalText: 't2', tags: { areas: ['discussion'], sentiments: ['growth'], standards: [] }, usedEntries: ['seed-discussion-growth-1'] },
    ];
    expect(result).toEqual(expected);
  });

  it('listCourseHistory filters by courseId instead (course rollup)', async () => {
    const db = { __fake: true };
    const collectionGroup = vi.fn((_db: unknown, id: string) => ({ __cg: id }));
    const where = vi.fn((f: string, op: string, v: unknown) => ({ __where: [f, op, v] }));
    const query = vi.fn((coll: unknown, ...clauses: unknown[]) => ({ __query: { coll, clauses } }));
    const getDocs = vi.fn(async () => ({ docs: [] }));

    const { listCourseHistory } = await import('./listPeriodHistory');
    await listCourseHistory(db as never, 'teacher-1', 'c1', {
      collectionGroup, where, query, getDocs,
    } as never);

    expect(where).toHaveBeenCalledWith('courseId', '==', 'c1');
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/data/listPeriodHistory.test.ts` → fails (module missing).

**Step 3 — Minimal impl (REAL code).** Create `src/data/listPeriodHistory.ts`:

```ts
import {
  collectionGroup as fbCollectionGroup,
  getDocs as fbGetDocs,
  query as fbQuery,
  where as fbWhere,
  type Firestore,
} from 'firebase/firestore';
import type { FeedbackHistoryEntry } from '../types';

export interface HistoryGroupReadDeps {
  collectionGroup: typeof fbCollectionGroup;
  getDocs: typeof fbGetDocs;
  query: typeof fbQuery;
  where: typeof fbWhere;
}

const defaultDeps: HistoryGroupReadDeps = {
  collectionGroup: fbCollectionGroup,
  getDocs: fbGetDocs,
  query: fbQuery,
  where: fbWhere,
};

async function readBy(
  db: Firestore,
  field: 'periodId' | 'courseId',
  value: string,
  deps: HistoryGroupReadDeps,
): Promise<FeedbackHistoryEntry[]> {
  const { collectionGroup, getDocs, query, where } = deps;
  const cg = collectionGroup(db, 'feedbackHistory');
  const q = query(cg, where(field, '==', value));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<FeedbackHistoryEntry, 'id'>),
  }));
}

/**
 * All feedbackHistory entries for one period, across every student.
 * Uses a collection-group query so it spans the per-student subcollections;
 * the security rules still scope this to the signed-in teacher's tree.
 * `uid` is accepted for call-site symmetry and future per-uid scoping.
 */
export async function listPeriodHistory(
  db: Firestore,
  _uid: string,
  periodId: string,
  deps: HistoryGroupReadDeps = defaultDeps,
): Promise<FeedbackHistoryEntry[]> {
  return readBy(db, 'periodId', periodId, deps);
}

/** Course rollup: every entry under a course, across all its periods. */
export async function listCourseHistory(
  db: Firestore,
  _uid: string,
  courseId: string,
  deps: HistoryGroupReadDeps = defaultDeps,
): Promise<FeedbackHistoryEntry[]> {
  return readBy(db, 'courseId', courseId, deps);
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/data/listPeriodHistory.test.ts` → green.

**Step 5 — Commit.** `git add src/data/listPeriodHistory.ts src/data/listPeriodHistory.test.ts && git commit -m "feat(history): listPeriodHistory/listCourseHistory collection-group reads for trends"`

---

### Task H3: `summarizeHistoryEntry` (pure dated-summary formatter)

Both the inline compose panel and the per-student page render one-line dated summaries like `Oct 12 · Q1 — Strong quarter, Ada.`. Extract that as a pure, tested formatter so both surfaces share it.

**Step 1 — Failing test (REAL code).** Create `src/feedback/summarizeHistoryEntry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { summarizeHistoryEntry } from './summarizeHistoryEntry';
import type { FeedbackHistoryEntry } from '../types';

const base: FeedbackHistoryEntry = {
  id: 'h1', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
  // 2025-10-12T15:00:00Z — fixed epoch ms so the format is deterministic.
  sentAt: Date.UTC(2025, 9, 12, 15, 0, 0),
  gradingPeriod: 'Q1',
  finalText: 'Strong quarter, Ada. Your CER was the sharpest in class and your evidence held up.',
  tags: { areas: ['cer'], sentiments: ['strength'], standards: ['argumentation'] },
  usedEntries: ['seed-cer-success-1'],
};

describe('summarizeHistoryEntry', () => {
  it('formats "MMM D · <gradingPeriod> — <label or trimmed finalText>"', () => {
    expect(summarizeHistoryEntry(base)).toBe(
      'Oct 12 · Q1 — Strong quarter, Ada. Your CER was the sharpest in class and your…',
    );
  });

  it('prefers an explicit label over finalText when present', () => {
    expect(summarizeHistoryEntry({ ...base, label: 'Quarter check-in' })).toBe(
      'Oct 12 · Q1 — Quarter check-in',
    );
  });

  it('does not append an ellipsis when the text already fits', () => {
    expect(summarizeHistoryEntry({ ...base, finalText: 'Nice work.' })).toBe(
      'Oct 12 · Q1 — Nice work.',
    );
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/feedback/summarizeHistoryEntry.test.ts` → fails (module missing).

**Step 3 — Minimal impl (REAL code).** Create `src/feedback/summarizeHistoryEntry.ts`:

```ts
import type { FeedbackHistoryEntry } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SUMMARY_MAX = 60;

/** "Oct 12" from an epoch-ms timestamp, in UTC for deterministic formatting. */
export function formatHistoryDate(sentAt: number): string {
  const d = new Date(sentAt);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Trim to a word boundary under the cap and append … only when truncated. */
function trimText(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= SUMMARY_MAX) return collapsed;
  const cut = collapsed.slice(0, SUMMARY_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * One-line dated summary for an entry, e.g. "Oct 12 · Q1 — Strong quarter, Ada…".
 * Uses the entry's explicit label when set, otherwise a trimmed finalText.
 */
export function summarizeHistoryEntry(entry: FeedbackHistoryEntry): string {
  const date = formatHistoryDate(entry.sentAt);
  const body = entry.label ? entry.label : trimText(entry.finalText);
  return `${date} · ${entry.gradingPeriod} — ${body}`;
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/feedback/summarizeHistoryEntry.test.ts` → green.

**Step 5 — Commit.** `git add src/feedback/summarizeHistoryEntry.ts src/feedback/summarizeHistoryEntry.test.ts && git commit -m "feat(history): pure summarizeHistoryEntry dated-summary formatter"`

---

### Task H4: `ComposeHistoryPanel` (inline recent-feedback panel)

An inline, presentational panel for the compose flow: given a student's recent `FeedbackHistoryEntry[]`, it renders dated summaries so the teacher sees what was already sent before writing the next message.

**Step 1 — Failing test (REAL code).** Create `src/compose/ComposeHistoryPanel.test.tsx`:

```ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComposeHistoryPanel } from './ComposeHistoryPanel';
import type { FeedbackHistoryEntry } from '../types';

function entry(over: Partial<FeedbackHistoryEntry>): FeedbackHistoryEntry {
  return {
    id: 'h', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
    sentAt: Date.UTC(2025, 9, 12, 15, 0, 0), gradingPeriod: 'Q1',
    finalText: 'Strong quarter, Ada.',
    tags: { areas: ['cer'], sentiments: ['strength'], standards: [] },
    usedEntries: ['seed-cer-success-1'],
    ...over,
  };
}

describe('ComposeHistoryPanel', () => {
  it('renders dated summaries for each recent entry, newest first', () => {
    const entries = [
      entry({ id: 'h2', sentAt: Date.UTC(2026, 0, 5, 15, 0, 0), gradingPeriod: 'Q2', label: 'Mid-year note' }),
      entry({ id: 'h1' }),
    ];
    render(<ComposeHistoryPanel studentName="Ada" entries={entries} />);

    expect(screen.getByText('Jan 5 · Q2 — Mid-year note')).toBeInTheDocument();
    expect(screen.getByText('Oct 12 · Q1 — Strong quarter, Ada.')).toBeInTheDocument();
    // Newest entry is rendered before the older one.
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Jan 5');
    expect(items[1]).toHaveTextContent('Oct 12');
  });

  it('shows an empty-state message when there is no prior feedback', () => {
    render(<ComposeHistoryPanel studentName="Ada" entries={[]} />);
    expect(screen.getByText(/no feedback sent to ada yet/i)).toBeInTheDocument();
  });

  it('caps the list at the most recent N (default 5)', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      entry({ id: `h${i}`, sentAt: Date.UTC(2025, 8, 1 + i, 12, 0, 0), finalText: `note ${i}` }),
    ).reverse(); // newest first, as the data fn returns them
    render(<ComposeHistoryPanel studentName="Ada" entries={many} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/compose/ComposeHistoryPanel.test.tsx` → fails (module missing).

**Step 3 — Minimal impl (REAL code).** Create `src/compose/ComposeHistoryPanel.tsx`:

```tsx
import type { FeedbackHistoryEntry } from '../types';
import { summarizeHistoryEntry } from '../feedback/summarizeHistoryEntry';
import { tokens, panelStyle } from '../ui/theme';

export interface ComposeHistoryPanelProps {
  studentName: string;
  /** Already newest-first (as listStudentHistory returns them). */
  entries: FeedbackHistoryEntry[];
  /** Max summaries to show in the inline panel. */
  limit?: number;
}

/**
 * Inline "what was sent before" panel for the compose flow. Purely
 * presentational — the caller loads entries via listStudentHistory and passes
 * them in. Renders one dated summary line per recent entry.
 */
export function ComposeHistoryPanel({
  studentName,
  entries,
  limit = 5,
}: ComposeHistoryPanelProps) {
  const recent = entries.slice(0, limit);
  return (
    <aside className="compose-history" style={panelStyle()} aria-label={`Recent feedback for ${studentName}`}>
      <div className="label" style={{ color: tokens.color.muted, marginBottom: tokens.space(1) }}>
        Recent feedback
      </div>
      {recent.length === 0 ? (
        <p style={{ color: tokens.color.muted, margin: 0 }}>
          No feedback sent to {studentName} yet.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: tokens.space(1) }}>
          {recent.map((e) => (
            <li key={e.id} style={{ color: tokens.color.subtle, fontSize: 13 }}>
              {summarizeHistoryEntry(e)}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/compose/ComposeHistoryPanel.test.tsx` → green.

**Step 5 — Commit.** `git add src/compose/ComposeHistoryPanel.tsx src/compose/ComposeHistoryPanel.test.tsx && git commit -m "feat(compose): inline ComposeHistoryPanel of recent feedback summaries"`

---

### Task H5: `StudentHistoryPage` (`/student/:studentId/history`, chronological)

A per-student page that loads the full chronological history (newest first) and renders dated summaries plus full text. Smoke-tested with injected deps; the route param + location are read from the URL.

**Step 1 — Failing test (REAL code).** Create `src/pages/StudentHistoryPage.test.tsx`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { FeedbackHistoryEntry } from '../types';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } }),
}));

import { StudentHistoryPage } from './StudentHistoryPage';

const history: FeedbackHistoryEntry[] = [
  {
    id: 'h2', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
    sentAt: Date.UTC(2026, 0, 5, 15, 0, 0), gradingPeriod: 'Q2', label: 'Mid-year note',
    finalText: 'Keep it up, Ada.',
    tags: { areas: ['discussion'], sentiments: ['strength'], standards: [] },
    usedEntries: ['seed-discussion-success-1'],
  },
  {
    id: 'h1', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1',
    sentAt: Date.UTC(2025, 9, 12, 15, 0, 0), gradingPeriod: 'Q1',
    finalText: 'Strong quarter, Ada.',
    tags: { areas: ['cer'], sentiments: ['growth'], standards: [] },
    usedEntries: ['seed-cer-success-1'],
  },
];

function renderAt(deps: { listStudentHistory: ReturnType<typeof vi.fn>; studentName?: string }) {
  return render(
    <MemoryRouter initialEntries={['/student/s1/history?year=y1&course=c1&period=p1']}>
      <Routes>
        <Route path="/student/:studentId/history" element={<StudentHistoryPage deps={deps} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StudentHistoryPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the student history for the location from the query string', async () => {
    const listStudentHistory = vi.fn(async () => history);
    renderAt({ listStudentHistory });
    await screen.findByText('Mid-year note', { exact: false });
    expect(listStudentHistory).toHaveBeenCalledWith({ __fake: true }, 'u1', {
      yearId: 'y1', courseId: 'c1', periodId: 'p1', studentId: 's1',
    });
  });

  it('renders entries chronologically, newest first, with dated summary and full text', async () => {
    const listStudentHistory = vi.fn(async () => history);
    renderAt({ listStudentHistory });
    const articles = await screen.findAllByRole('article');
    expect(articles).toHaveLength(2);
    expect(articles[0]).toHaveTextContent('Jan 5 · Q2 — Mid-year note');
    expect(articles[0]).toHaveTextContent('Keep it up, Ada.');
    expect(articles[1]).toHaveTextContent('Oct 12 · Q1');
    expect(articles[1]).toHaveTextContent('Strong quarter, Ada.');
  });

  it('shows an empty state when the student has no history', async () => {
    const listStudentHistory = vi.fn(async () => []);
    renderAt({ listStudentHistory });
    expect(await screen.findByText(/no feedback history yet/i)).toBeInTheDocument();
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/pages/StudentHistoryPage.test.tsx` → fails (module missing).

**Step 3 — Minimal impl (REAL code).** Create `src/pages/StudentHistoryPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { listStudentHistory } from '../data/listStudentHistory';
import { summarizeHistoryEntry } from '../feedback/summarizeHistoryEntry';
import type { FeedbackHistoryEntry } from '../types';
import { tokens, panelStyle } from '../ui/theme';

export interface StudentHistoryPageDeps {
  uid: string;
  listStudentHistory: typeof listStudentHistory;
}

export function StudentHistoryPage({ deps }: { deps?: Partial<StudentHistoryPageDeps> }) {
  const { studentId = '' } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const load = deps?.listStudentHistory ?? listStudentHistory;

  const yearId = params.get('year') ?? '';
  const courseId = params.get('course') ?? '';
  const periodId = params.get('period') ?? '';

  const [entries, setEntries] = useState<FeedbackHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !studentId) return;
    let alive = true;
    load(db, uid, { yearId, courseId, periodId, studentId })
      .then((e) => alive && setEntries(e))
      .catch(() => alive && setError('Could not load this student’s history.'));
    return () => {
      alive = false;
    };
  }, [uid, studentId, yearId, courseId, periodId, load]);

  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: tokens.space(4) }}>
      <h1>Feedback history</h1>
      {error && <p role="alert">{error}</p>}
      {entries !== null && entries.length === 0 && (
        <p style={{ color: tokens.color.muted }}>No feedback history yet.</p>
      )}
      <div style={{ display: 'grid', gap: tokens.space(2) }}>
        {(entries ?? []).map((e) => (
          <article key={e.id} style={panelStyle()}>
            <div style={{ color: tokens.color.teal, fontSize: 13, marginBottom: tokens.space(1) }}>
              {summarizeHistoryEntry(e)}
            </div>
            <p style={{ margin: 0, color: tokens.color.text, whiteSpace: 'pre-wrap' }}>
              {e.finalText}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/pages/StudentHistoryPage.test.tsx` → green.

**Step 5 — Commit.** `git add src/pages/StudentHistoryPage.tsx src/pages/StudentHistoryPage.test.tsx && git commit -m "feat(history): per-student chronological StudentHistoryPage (/student/:studentId/history)"`

---

### Task H6: `aggregateTrends` (pure analytics core) — counts by area/sentiment/gradingPeriod/standard

The analytics heart. A pure fn over `FeedbackHistoryEntry[]` producing counts by area, by sentiment, by gradingPeriod, and by standard. Sentiment is **re-derived** from the raw `usedEntries` via the taxonomy (proving trends survive a future mapping change), with the stored `tags.sentiments` used only as a fallback when a bank lookup isn't supplied. Thoroughly unit-tested.

**Step 1 — Failing test (REAL code).** Create `src/feedback/aggregateTrends.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { aggregateTrends } from './aggregateTrends';
import type { BankEntry, FeedbackHistoryEntry } from '../types';

// Minimal bank: only the `tags.type` matters for sentiment re-derivation.
const bank: BankEntry[] = [
  { id: 'b-success', templateText: '', slots: [], tags: { type: 'success', area: 'cer', objective: 'argumentation' } },
  { id: 'b-growth', templateText: '', slots: [], tags: { type: 'growth', area: 'discussion', objective: 'participation' } },
  { id: 'b-behavior', templateText: '', slots: [], tags: { type: 'behavior', area: 'collaboration', objective: 'reliability' } },
];

function h(over: Partial<FeedbackHistoryEntry>): FeedbackHistoryEntry {
  return {
    id: 'h', studentId: 's', periodId: 'p1', courseId: 'c1', yearId: 'y1',
    sentAt: 0, gradingPeriod: 'Q1', finalText: '',
    tags: { areas: [], sentiments: [], standards: [] },
    usedEntries: [],
    ...over,
  };
}

describe('aggregateTrends', () => {
  it('counts by area from entry tags.areas', () => {
    const entries = [
      h({ tags: { areas: ['cer', 'discussion'], sentiments: ['strength'], standards: [] } }),
      h({ tags: { areas: ['cer'], sentiments: ['growth'], standards: [] } }),
    ];
    const t = aggregateTrends(entries, bank);
    expect(t.byArea).toEqual({ cer: 2, discussion: 1 });
  });

  it('re-derives sentiment from usedEntries via the taxonomy, not from stored tags', () => {
    // Stored sentiments deliberately WRONG to prove re-derivation wins.
    const entries = [
      h({ usedEntries: ['b-success'], tags: { areas: ['cer'], sentiments: ['growth'], standards: [] } }),
      h({ usedEntries: ['b-growth'], tags: { areas: ['discussion'], sentiments: ['strength'], standards: [] } }),
      h({ usedEntries: ['b-behavior'], tags: { areas: ['collaboration'], sentiments: ['strength'], standards: [] } }),
    ];
    const t = aggregateTrends(entries, bank);
    // success→strength, growth→growth, behavior→neutral
    expect(t.bySentiment).toEqual({ strength: 1, growth: 1, neutral: 1 });
    expect(t.strengthGrowthBalance).toEqual({ strength: 1, growth: 1 });
  });

  it('falls back to stored tags.sentiments when a usedEntry is not in the bank', () => {
    const entries = [h({ usedEntries: ['unknown-id'], tags: { areas: [], sentiments: ['strength'], standards: [] } })];
    const t = aggregateTrends(entries, bank);
    expect(t.bySentiment).toEqual({ strength: 1 });
  });

  it('counts by gradingPeriod and by standard', () => {
    const entries = [
      h({ gradingPeriod: 'Q1', tags: { areas: [], sentiments: [], standards: ['argumentation', 'reasoning'] } }),
      h({ gradingPeriod: 'Q1', tags: { areas: [], sentiments: [], standards: ['argumentation'] } }),
      h({ gradingPeriod: 'Q2', tags: { areas: [], sentiments: [], standards: [] } }),
    ];
    const t = aggregateTrends(entries, bank);
    expect(t.byGradingPeriod).toEqual({ Q1: 2, Q2: 1 });
    expect(t.byStandard).toEqual({ argumentation: 2, reasoning: 1 });
  });

  it('topGrowthAreas lists areas of growth-sentiment entries, most frequent first', () => {
    const entries = [
      h({ usedEntries: ['b-growth'], tags: { areas: ['discussion'], sentiments: [], standards: [] } }),
      h({ usedEntries: ['b-growth'], tags: { areas: ['discussion'], sentiments: [], standards: [] } }),
      h({ usedEntries: ['b-growth'], tags: { areas: ['research'], sentiments: [], standards: [] } }),
      h({ usedEntries: ['b-success'], tags: { areas: ['cer'], sentiments: [], standards: [] } }),
    ];
    const t = aggregateTrends(entries, bank);
    expect(t.topGrowthAreas).toEqual([
      { area: 'discussion', count: 2 },
      { area: 'research', count: 1 },
    ]);
  });

  it('returns all-empty buckets for no entries', () => {
    const t = aggregateTrends([], bank);
    expect(t).toEqual({
      total: 0,
      byArea: {},
      bySentiment: {},
      byGradingPeriod: {},
      byStandard: {},
      strengthGrowthBalance: { strength: 0, growth: 0 },
      topGrowthAreas: [],
    });
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/feedback/aggregateTrends.test.ts` → fails (module missing).

**Step 3 — Minimal impl (REAL code).** Create `src/feedback/aggregateTrends.ts`:

```ts
import type { BankEntry, FeedbackHistoryEntry } from '../types';
import { sentimentForType, type Sentiment } from './taxonomy';

export type CountMap = Record<string, number>;

export interface TrendsSummary {
  total: number;
  byArea: CountMap;
  bySentiment: CountMap;
  byGradingPeriod: CountMap;
  byStandard: CountMap;
  /** Just the two directional buckets, for a strength/growth balance bar. */
  strengthGrowthBalance: { strength: number; growth: number };
  /** Growth-sentiment entries' areas, most frequent first. */
  topGrowthAreas: Array<{ area: string; count: number }>;
}

function bump(map: CountMap, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

/**
 * Pure trends aggregation over feedbackHistory entries.
 *
 * Sentiment is RE-DERIVED from each entry's raw `usedEntries` (bank ids) through
 * the taxonomy's type→sentiment map, so the analytics survive a future mapping
 * change without rewriting stored data. Stored `tags.sentiments` is used only as
 * a fallback for entries whose bank id is no longer resolvable.
 */
export function aggregateTrends(
  entries: FeedbackHistoryEntry[],
  bank: BankEntry[],
): TrendsSummary {
  const typeById = new Map(bank.map((b) => [b.id, b.tags.type]));

  const byArea: CountMap = {};
  const bySentiment: CountMap = {};
  const byGradingPeriod: CountMap = {};
  const byStandard: CountMap = {};
  const growthAreaCounts: CountMap = {};

  for (const e of entries) {
    bump(byGradingPeriod, e.gradingPeriod);
    for (const area of e.tags.areas) bump(byArea, area);
    for (const std of e.tags.standards) bump(byStandard, std);

    // Re-derive this entry's sentiments from its bank ids; fall back to stored.
    const derived: Sentiment[] = [];
    for (const id of e.usedEntries) {
      if (typeById.has(id)) derived.push(sentimentForType(typeById.get(id)));
    }
    const sentiments: string[] =
      derived.length > 0 ? derived : e.tags.sentiments;
    for (const s of sentiments) bump(bySentiment, s);

    // Areas of growth-flavored entries feed the "top growth areas" ranking.
    if (sentiments.includes('growth')) {
      for (const area of e.tags.areas) bump(growthAreaCounts, area);
    }
  }

  const topGrowthAreas = Object.entries(growthAreaCounts)
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));

  return {
    total: entries.length,
    byArea,
    bySentiment,
    byGradingPeriod,
    byStandard,
    strengthGrowthBalance: {
      strength: bySentiment['strength'] ?? 0,
      growth: bySentiment['growth'] ?? 0,
    },
    topGrowthAreas,
  };
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/feedback/aggregateTrends.test.ts` → green.

**Step 5 — Commit.** `git add src/feedback/aggregateTrends.ts src/feedback/aggregateTrends.test.ts && git commit -m "feat(trends): pure aggregateTrends analytics core re-derived from usedEntries"`

---

### Task H7: `TrendsView` (presentational rendering of a `TrendsSummary`)

A pure presentational component that renders a `TrendsSummary`: top growth areas, the strength/growth balance, and the by-gradingPeriod comparison. Splitting view from page keeps the page a thin loader and lets the rendering be unit-tested directly.

**Step 1 — Failing test (REAL code).** Create `src/components/TrendsView.test.tsx`:

```ts
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TrendsView } from './TrendsView';
import type { TrendsSummary } from '../feedback/aggregateTrends';

const summary: TrendsSummary = {
  total: 7,
  byArea: { cer: 3, discussion: 2, research: 2 },
  bySentiment: { strength: 4, growth: 2, neutral: 1 },
  byGradingPeriod: { Q1: 4, Q2: 3 },
  byStandard: { argumentation: 3, participation: 2 },
  strengthGrowthBalance: { strength: 4, growth: 2 },
  topGrowthAreas: [
    { area: 'discussion', count: 2 },
    { area: 'research', count: 1 },
  ],
};

describe('TrendsView', () => {
  it('renders the total feedback count', () => {
    render(<TrendsView summary={summary} />);
    expect(screen.getByText(/7 pieces of feedback/i)).toBeInTheDocument();
  });

  it('lists top growth areas in order', () => {
    render(<TrendsView summary={summary} />);
    const region = screen.getByRole('region', { name: /top growth areas/i });
    const items = within(region).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('discussion');
    expect(items[0]).toHaveTextContent('2');
    expect(items[1]).toHaveTextContent('research');
  });

  it('shows the strength/growth balance counts', () => {
    render(<TrendsView summary={summary} />);
    const region = screen.getByRole('region', { name: /strength.*growth balance/i });
    expect(within(region).getByText(/strength/i)).toBeInTheDocument();
    expect(within(region).getByTestId('balance-strength')).toHaveTextContent('4');
    expect(within(region).getByTestId('balance-growth')).toHaveTextContent('2');
  });

  it('compares grading periods in taxonomy order', () => {
    render(<TrendsView summary={summary} />);
    const region = screen.getByRole('region', { name: /by grading period/i });
    const cells = within(region).getAllByRole('listitem');
    expect(cells[0]).toHaveTextContent('Q1');
    expect(cells[0]).toHaveTextContent('4');
    expect(cells[1]).toHaveTextContent('Q2');
  });

  it('renders an empty state when there is no feedback', () => {
    const empty: TrendsSummary = {
      total: 0, byArea: {}, bySentiment: {}, byGradingPeriod: {}, byStandard: {},
      strengthGrowthBalance: { strength: 0, growth: 0 }, topGrowthAreas: [],
    };
    render(<TrendsView summary={empty} />);
    expect(screen.getByText(/no feedback yet/i)).toBeInTheDocument();
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/components/TrendsView.test.tsx` → fails (module missing).

**Step 3 — Minimal impl (REAL code).** Create `src/components/TrendsView.tsx`:

```tsx
import type { TrendsSummary } from '../feedback/aggregateTrends';
import { GRADING_PERIODS } from '../feedback/taxonomy';
import { tokens, panelStyle } from '../ui/theme';

export interface TrendsViewProps {
  summary: TrendsSummary;
}

/** Presentational rendering of a TrendsSummary. No data loading. */
export function TrendsView({ summary }: TrendsViewProps) {
  if (summary.total === 0) {
    return <p style={{ color: tokens.color.muted }}>No feedback yet.</p>;
  }

  // Grading periods rendered in canonical taxonomy order, present ones only.
  const periods = GRADING_PERIODS.filter((p) => summary.byGradingPeriod[p] != null);

  return (
    <div style={{ display: 'grid', gap: tokens.space(2) }}>
      <p style={{ color: tokens.color.subtle, margin: 0 }}>
        {summary.total} pieces of feedback
      </p>

      <section role="region" aria-label="Top growth areas" style={panelStyle()}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Top growth areas</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: tokens.space(1) }}>
          {summary.topGrowthAreas.map((g) => (
            <li key={g.area} style={{ color: tokens.color.text }}>
              {g.area} — {g.count}
            </li>
          ))}
        </ul>
      </section>

      <section role="region" aria-label="Strength / growth balance" style={panelStyle()}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Strength / growth balance</h2>
        <div style={{ display: 'flex', gap: tokens.space(3) }}>
          <span>
            Strength: <strong data-testid="balance-strength">{summary.strengthGrowthBalance.strength}</strong>
          </span>
          <span>
            Growth: <strong data-testid="balance-growth">{summary.strengthGrowthBalance.growth}</strong>
          </span>
        </div>
      </section>

      <section role="region" aria-label="By grading period" style={panelStyle()}>
        <h2 style={{ fontSize: 15, marginTop: 0 }}>By grading period</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: tokens.space(2) }}>
          {periods.map((p) => (
            <li key={p} style={{ color: tokens.color.text }}>
              {p}: <strong>{summary.byGradingPeriod[p]}</strong>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

**Step 4 — Run, expect PASS.** `npx vitest run src/components/TrendsView.test.tsx` → green.

**Step 5 — Commit.** `git add src/components/TrendsView.tsx src/components/TrendsView.test.tsx && git commit -m "feat(trends): TrendsView presentational summary (growth areas, balance, by-period)"`

---

### Task H8: `TrendsPage` (period view + course rollup), smoke-tested + routes wired

The live page: loads history (period via `listPeriodHistory`, course rollup via `listCourseHistory`) plus the bank, aggregates with `aggregateTrends`, and renders `TrendsView`. One route per scope. Smoke-tested with injected deps; routes added to `App.tsx`.

**Step 1 — Failing test (REAL code).** Create `src/pages/TrendsPage.test.tsx`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { BankEntry, FeedbackHistoryEntry } from '../types';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } }),
}));

import { TrendsPage } from './TrendsPage';

const bank: BankEntry[] = [
  { id: 'b-success', templateText: '', slots: [], tags: { type: 'success', area: 'cer' } },
  { id: 'b-growth', templateText: '', slots: [], tags: { type: 'growth', area: 'discussion' } },
];
const periodHistory: FeedbackHistoryEntry[] = [
  { id: 'h1', studentId: 's1', periodId: 'p1', courseId: 'c1', yearId: 'y1', sentAt: 100, gradingPeriod: 'Q1', finalText: 'x', tags: { areas: ['cer'], sentiments: [], standards: [] }, usedEntries: ['b-success'] },
  { id: 'h2', studentId: 's2', periodId: 'p1', courseId: 'c1', yearId: 'y1', sentAt: 150, gradingPeriod: 'Q1', finalText: 'y', tags: { areas: ['discussion'], sentiments: [], standards: [] }, usedEntries: ['b-growth'] },
];

function makeDeps(over: Partial<{ listPeriodHistory: ReturnType<typeof vi.fn>; listCourseHistory: ReturnType<typeof vi.fn>; listBank: ReturnType<typeof vi.fn> }> = {}) {
  return {
    listPeriodHistory: vi.fn(async () => periodHistory),
    listCourseHistory: vi.fn(async () => periodHistory),
    listBank: vi.fn(async () => bank),
    ...over,
  };
}

describe('TrendsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('period scope: loads period history + bank and renders the aggregated trends', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter initialEntries={['/course/c1/period/p1/trends']}>
        <Routes>
          <Route path="/course/:courseId/period/:periodId/trends" element={<TrendsPage deps={deps} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/2 pieces of feedback/i)).toBeInTheDocument();
    expect(deps.listPeriodHistory).toHaveBeenCalledWith({ __fake: true }, 'u1', 'p1');
    expect(deps.listCourseHistory).not.toHaveBeenCalled();
    // discussion entry derives growth → appears under top growth areas.
    const region = await screen.findByRole('region', { name: /top growth areas/i });
    expect(region).toHaveTextContent('discussion');
  });

  it('course scope: loads the course rollup instead', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter initialEntries={['/course/c1/trends']}>
        <Routes>
          <Route path="/course/:courseId/trends" element={<TrendsPage deps={deps} scope="course" />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText(/2 pieces of feedback/i);
    expect(deps.listCourseHistory).toHaveBeenCalledWith({ __fake: true }, 'u1', 'c1');
    expect(deps.listPeriodHistory).not.toHaveBeenCalled();
  });
});
```

**Step 2 — Run, expect FAIL.** `npx vitest run src/pages/TrendsPage.test.tsx` → fails (module missing).

**Step 3 — Minimal impl (REAL code).** Create `src/pages/TrendsPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { db } from '../firebase/config';
import { listPeriodHistory, listCourseHistory } from '../data/listPeriodHistory';
import { listBank } from '../bank/bankRepo';
import { aggregateTrends, type TrendsSummary } from '../feedback/aggregateTrends';
import { TrendsView } from '../components/TrendsView';
import { tokens } from '../ui/theme';

export interface TrendsPageDeps {
  uid: string;
  listPeriodHistory: typeof listPeriodHistory;
  listCourseHistory: typeof listCourseHistory;
  listBank: typeof listBank;
}

export function TrendsPage({
  deps,
  scope = 'period',
}: {
  deps?: Partial<TrendsPageDeps>;
  scope?: 'period' | 'course';
}) {
  const { courseId = '', periodId = '' } = useParams();
  const { user } = useAuth();
  const uid = deps?.uid ?? user?.uid ?? '';
  const api = {
    listPeriodHistory: deps?.listPeriodHistory ?? listPeriodHistory,
    listCourseHistory: deps?.listCourseHistory ?? listCourseHistory,
    listBank: deps?.listBank ?? listBank,
  };

  const [summary, setSummary] = useState<TrendsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const loadHistory =
      scope === 'course'
        ? api.listCourseHistory(db, uid, courseId)
        : api.listPeriodHistory(db, uid, periodId);
    Promise.all([loadHistory, api.listBank(db, uid)])
      .then(([entries, bank]) => {
        if (alive) setSummary(aggregateTrends(entries, bank));
      })
      .catch(() => alive && setError('Could not load trends.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, scope, courseId, periodId]);

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: tokens.space(4) }}>
      <h1>{scope === 'course' ? 'Course trends' : 'Period trends'}</h1>
      {error && <p role="alert">{error}</p>}
      {summary && <TrendsView summary={summary} />}
    </main>
  );
}
```

> Reuse note: `listBank(db, uid)` is the existing bank-read in `src/bank/bankRepo.ts`. If its exported name differs (e.g. `listBankEntries`), import that name instead — the page only needs the teacher's `BankEntry[]` for sentiment re-derivation.

**Step 4 — Run, expect PASS.** `npx vitest run src/pages/TrendsPage.test.tsx` → green.

**Step 5 — Wire routes + commit.** In `src/App.tsx`, add the imports and three `RequireAuth`-wrapped routes (above the `path="*"` catch-all):

```tsx
import { StudentHistoryPage } from './pages/StudentHistoryPage';
import { TrendsPage } from './pages/TrendsPage';
```

```tsx
<Route
  path="/student/:studentId/history"
  element={
    <RequireAuth>
      <StudentHistoryPage />
    </RequireAuth>
  }
/>
<Route
  path="/course/:courseId/period/:periodId/trends"
  element={
    <RequireAuth>
      <TrendsPage scope="period" />
    </RequireAuth>
  }
/>
<Route
  path="/course/:courseId/trends"
  element={
    <RequireAuth>
      <TrendsPage scope="course" />
    </RequireAuth>
  }
/>
```

Then run the full suite to confirm no regressions: `npx vitest run`. Commit: `git add src/pages/TrendsPage.tsx src/pages/TrendsPage.test.tsx src/App.tsx && git commit -m "feat(trends): TrendsPage (period view + course rollup) and wire history/trends routes"`

---

## Phase notes for the assembler

- **Upstream dependencies (must exist before this phase runs):** `src/feedback/taxonomy.ts` exporting `GRADING_PERIODS`, `Sentiment`, and `sentimentForType` (Phase 1); the new types `FeedbackHistoryEntry` (with `id, studentId, periodId, courseId, yearId, sentAt, gradingPeriod, label?, finalText, tags:{areas,sentiments,standards}, usedEntries`), `Year`, `Course`, `Period` added to `src/types.ts` (Phase 1); a bank-list read in `src/bank/bankRepo.ts` (existing — confirm the exact export name, `listBank` vs `listBankEntries`, when wiring Task 8). Phase 4's `writeFeedbackHistory` is what populates the collections these tasks read; it is not required for these tests (all reads are mocked).
- **New files created here:** `src/data/listStudentHistory.ts`, `src/data/listPeriodHistory.ts`, `src/feedback/summarizeHistoryEntry.ts`, `src/feedback/aggregateTrends.ts`, `src/compose/ComposeHistoryPanel.tsx`, `src/components/TrendsView.tsx`, `src/pages/StudentHistoryPage.tsx`, `src/pages/TrendsPage.tsx` (+ matching `*.test.*`).
- **Conventions honored:** DI data fns `(db, uid, ...args, deps?)` with injectable `collection`/`getDocs`/`query`/`orderBy`/`where`/`collectionGroup`; `vi.fn` inline mocks (no real Firebase); page smoke tests via `MemoryRouter` + `Routes`/`Route` and `vi.mock` of `../firebase/config` and `../auth/useAuth`; styling via `src/ui/theme.ts` tokens; sentiment/grading-period sourced only from `src/feedback/taxonomy.ts`.
- **Re-derivability proof** lives in Task 6's second test: stored `tags.sentiments` are intentionally wrong and the raw `usedEntries`→taxonomy path wins, demonstrating trends survive a future mapping change.
- **One spec discrepancy worth flagging:** the spec path given in the prompt (`docs/superpowers/specs/2026-06-16-year-course-period-redesign.md`) does not exist in the repo; only `docs/superpowers/specs/2026-06-16-personalized-student-feedback-emails-design.md` is present. I built this phase strictly from the inline canonical decisions in the prompt, which the existing-code paths corroborate. If the redesign spec exists elsewhere, reconcile the `feedbackHistory` field names against it before implementation.

---

## Phase 6 — UI polish (B+C)

## PHASE 6 — B+C UI Polish Pass

Every screen built in the earlier phases is wired and green; this phase brings each one up to the mockup polish already set by `SendStepper`. The rule for every task: **styling is additive** — wrap/decorate existing markup, never rename roles/labels/testids, never remove a queryable element. Each task re-runs the screen's own existing test file to prove the queries still resolve.

All new visual primitives live in `src/ui/theme.ts` (Task 1) so screens import shared helpers and never hardcode hexes. Period chips read the grading-period list and tag categories from `src/feedback/taxonomy.ts` (built in an earlier phase) — never re-declared here.

Single-file test runner used throughout: `npx vitest run <path>`.

---

### Task U1: Shared B+C layout primitives in `src/ui/theme.ts`

Add the reusable card / progress-bar / breadcrumb / nav-bar / period-chip style helpers that every screen task below imports. This keeps the polish consistent and config-free of hardcoded hexes.

**Step 1 — Failing test (append REAL code to `src/ui/theme.test.ts`):**

```ts
import { describe, it, expect } from 'vitest';
import {
  tokens,
  cardStyle,
  progressTrackStyle,
  progressFillStyle,
  breadcrumbStyle,
  breadcrumbSepStyle,
  navBarStyle,
  periodChipStyle,
} from './theme';

describe('B+C layout primitives', () => {
  it('cardStyle is a panel surface with generous radius and 3-unit padding', () => {
    const s = cardStyle();
    expect(s.background).toBe(tokens.color.panel);
    expect(s.border).toBe(`1px solid ${tokens.color.border}`);
    expect(s.borderRadius).toBe(tokens.radius.lg);
    expect(s.padding).toBe(tokens.space(3));
  });

  it('progressTrackStyle is a thin rounded track on panelAlt', () => {
    const s = progressTrackStyle();
    expect(s.height).toBe(4);
    expect(s.background).toBe(tokens.color.panelAlt);
    expect(s.overflow).toBe('hidden');
  });

  it('progressFillStyle paints a teal bar at the given percentage width', () => {
    const s = progressFillStyle(40);
    expect(s.width).toBe('40%');
    expect(s.background).toBe(tokens.color.teal);
    expect(s.height).toBe('100%');
  });

  it('progressFillStyle clamps out-of-range percentages to 0..100', () => {
    expect(progressFillStyle(-5).width).toBe('0%');
    expect(progressFillStyle(150).width).toBe('100%');
  });

  it('breadcrumbStyle is a muted inline row; separators are subtler still', () => {
    expect(breadcrumbStyle().display).toBe('flex');
    expect(breadcrumbStyle().color).toBe(tokens.color.muted);
    expect(breadcrumbSepStyle().color).toBe(tokens.color.border);
  });

  it('navBarStyle is a bordered top bar on the panel surface', () => {
    const s = navBarStyle();
    expect(s.background).toBe(tokens.color.panel);
    expect(s.borderBottom).toBe(`1px solid ${tokens.color.border}`);
    expect(s.display).toBe('flex');
  });

  it('periodChipStyle reuses the chip look and highlights the active period', () => {
    expect(periodChipStyle(true).borderColor).toBe(tokens.color.teal);
    expect(periodChipStyle(true).color).toBe(tokens.color.teal);
    expect(periodChipStyle(false).borderColor).toBe(tokens.color.border);
  });
});
```

**Step 2 — Run, expect FAIL:**

```
npx vitest run src/ui/theme.test.ts
```

Expect failures: `cardStyle is not a function`, `progressFillStyle is not a function`, etc. (the new exports do not exist yet).

**Step 3 — Minimal impl (append REAL code to `src/ui/theme.ts`, after `kbdHintStyle`):**

```ts
/** A raised content card — the standard course/student/setup surface.
 *  Slightly larger radius + padding than panelStyle for hero cards. */
export function cardStyle(): CSSProperties {
  return {
    background: tokens.color.panel,
    border: `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.lg,
    color: tokens.color.text,
    padding: tokens.space(3),
  };
}

/** The rounded track behind a progress bar (matches SendStepper's bar). */
export function progressTrackStyle(): CSSProperties {
  return {
    height: 4,
    background: tokens.color.panelAlt,
    borderRadius: 99,
    overflow: 'hidden',
  };
}

/** The teal fill of a progress bar. `pct` is clamped to 0..100. */
export function progressFillStyle(pct: number): CSSProperties {
  const clamped = Math.max(0, Math.min(100, pct));
  return {
    width: `${clamped}%`,
    height: '100%',
    background: tokens.color.teal,
  };
}

/** The breadcrumb row container (Year › Course › Period). */
export function breadcrumbStyle(): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: tokens.color.muted,
    fontFamily: tokens.font,
  };
}

/** The "›" separator between crumbs — subtler than the crumbs themselves. */
export function breadcrumbSepStyle(): CSSProperties {
  return {
    color: tokens.color.border,
    fontSize: 13,
    userSelect: 'none',
  };
}

/** The persistent top navigation bar surface. */
export function navBarStyle(): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.space(3),
    background: tokens.color.panel,
    borderBottom: `1px solid ${tokens.color.border}`,
    padding: `${tokens.space(1.5)}px ${tokens.space(3)}px`,
    fontFamily: tokens.font,
  };
}

/** A period/section chip. Pill-shaped; active === current period → teal. */
export function periodChipStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: active ? 'rgba(95,184,168,0.12)' : tokens.color.panelAlt,
    color: active ? tokens.color.teal : tokens.color.subtle,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: active ? tokens.color.teal : tokens.color.border,
    borderRadius: 999,
    padding: '2px 9px',
    fontSize: 12,
    fontFamily: tokens.font,
  };
}
```

**Step 4 — Run, expect PASS:**

```
npx vitest run src/ui/theme.test.ts
```

Expect all theme tests (the original six + the seven new ones) green.

**Step 5 — Commit:**

```
git add src/ui/theme.ts src/ui/theme.test.ts
git commit -m "Add B+C layout primitives (card, progress, breadcrumb, nav, period chip) to theme

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task U2: Polish NavBar + Breadcrumbs

Apply `navBarStyle`, `breadcrumbStyle`, and `breadcrumbSepStyle` to the persistent nav and the `Year › Course › Period` breadcrumb row. The links keep their accessible names ("Home", "Bank", "Sign out") and the crumbs keep their `role="link"` so wayfinding tests stay green.

**Step 1 — Failing test (append REAL code to `src/nav/NavBar.test.tsx`):**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavBar } from './NavBar';

describe('NavBar — B+C polish', () => {
  it('renders the brand and Home / Bank / Sign out without losing their names', () => {
    render(
      <MemoryRouter>
        <NavBar onSignOut={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Feedback')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bank' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('the nav is a styled top bar (panel background, bottom border)', () => {
    render(
      <MemoryRouter>
        <NavBar onSignOut={() => {}} />
      </MemoryRouter>,
    );
    const bar = screen.getByRole('navigation', { name: 'Primary' });
    expect(bar).toHaveStyle({ background: '#15171c' });
    expect(bar).toHaveStyle({ borderBottom: '1px solid #23262e' });
  });
});
```

**Step 2 — Run, expect FAIL:**

```
npx vitest run src/nav/NavBar.test.tsx
```

Expect failure: the `<nav>` has no inline background/border yet, so the `toHaveStyle({ background: '#15171c' })` assertion fails.

**Step 3 — Minimal impl (edit REAL `src/nav/NavBar.tsx` additively — preserve all link/button names and the `aria-label="Primary"`):**

```tsx
import { Link } from 'react-router-dom';
import { tokens, navBarStyle, tealButtonStyle } from '../ui/theme';

export interface NavBarProps {
  onSignOut: () => void;
}

export function NavBar({ onSignOut }: NavBarProps) {
  return (
    <nav aria-label="Primary" style={navBarStyle()}>
      <Link
        to="/"
        style={{
          fontWeight: 700,
          fontSize: 17,
          letterSpacing: '-0.01em',
          color: tokens.color.text,
        }}
      >
        Feedback
      </Link>
      <Link to="/" style={{ color: tokens.color.subtle, fontWeight: 500 }}>
        Home
      </Link>
      <Link to="/bank" style={{ color: tokens.color.subtle, fontWeight: 500 }}>
        Bank
      </Link>
      <button
        type="button"
        onClick={onSignOut}
        style={{ ...tealButtonStyle(), marginLeft: 'auto', padding: '7px 14px', fontSize: 14 }}
      >
        Sign out
      </button>
    </nav>
  );
}
```

And edit REAL `src/nav/Breadcrumbs.tsx` additively (wrap the existing crumb `<Link>`s; keep each crumb's text and the trailing non-link current crumb):

```tsx
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { tokens, breadcrumbStyle, breadcrumbSepStyle } from '../ui/theme';

export interface Crumb {
  label: string;
  to?: string; // omitted for the current (non-clickable) location
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" style={breadcrumbStyle()}>
      {crumbs.map((c, i) => (
        <Fragment key={`${c.label}-${i}`}>
          {i > 0 && <span style={breadcrumbSepStyle()}>›</span>}
          {c.to ? (
            <Link to={c.to} style={{ color: tokens.color.muted }}>
              {c.label}
            </Link>
          ) : (
            <span style={{ color: tokens.color.text }}>{c.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
```

**Step 4 — Run, expect PASS:**

```
npx vitest run src/nav/NavBar.test.tsx src/nav/Breadcrumbs.test.tsx
```

Expect all NavBar and Breadcrumbs tests green (new style assertions + the pre-existing wayfinding tests from the navigation phase).

**Step 5 — Commit:**

```
git add src/nav/NavBar.tsx src/nav/NavBar.test.tsx src/nav/Breadcrumbs.tsx
git commit -m "Polish NavBar + Breadcrumbs with B+C top-bar and breadcrumb tokens

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task U3: Polish HomePage course-card dashboard

Wrap each course in `cardStyle`, render its sections as `periodChipStyle` chips, and give each period's "N/M sent" a `progressTrack`/`progressFill` bar. The "Write feedback" / "Trends" links and the `+ Add a course` card keep their accessible names; the per-period progress keeps its existing testid.

**Step 1 — Failing test (append REAL code to `src/pages/HomePage.test.tsx`):**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Course, Period } from '../types';
import { HomeDashboard } from './HomePage';

const courses: Course[] = [{ id: 'c1', name: '8th Grade U.S. History' }];
const periodsByCourse: Record<string, Period[]> = {
  c1: [{ id: 'p4', label: 'Period 4', order: 4 }],
};
const progressByPeriod: Record<string, { sent: number; total: number }> = {
  p4: { sent: 12, total: 29 },
};

describe('HomeDashboard — B+C polish', () => {
  it('keeps the course name, period chip and per-period progress queryable', () => {
    render(
      <MemoryRouter>
        <HomeDashboard
          courses={courses}
          periodsByCourse={periodsByCourse}
          progressByPeriod={progressByPeriod}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('8th Grade U.S. History')).toBeInTheDocument();
    expect(screen.getByText('Period 4')).toBeInTheDocument();
    expect(screen.getByTestId('period-progress-p4')).toHaveTextContent('12 / 29 sent');
  });

  it('renders the per-period progress bar with the correct fill percentage', () => {
    render(
      <MemoryRouter>
        <HomeDashboard
          courses={courses}
          periodsByCourse={periodsByCourse}
          progressByPeriod={progressByPeriod}
        />
      </MemoryRouter>,
    );
    const bar = screen.getByRole('progressbar', { name: 'Period 4 feedback progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '12');
    expect(bar).toHaveAttribute('aria-valuemax', '29');
    // 12/29 ≈ 41%
    const fill = within(bar).getByTestId('period-progress-fill-p4');
    expect(fill).toHaveStyle({ width: '41%' });
  });

  it('keeps Write feedback / Trends links and the Add-a-course affordance', () => {
    render(
      <MemoryRouter>
        <HomeDashboard
          courses={courses}
          periodsByCourse={periodsByCourse}
          progressByPeriod={progressByPeriod}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /write feedback/i })).toHaveAttribute(
      'href',
      '/course/c1/period/p4/compose',
    );
    expect(screen.getByRole('link', { name: /trends/i })).toHaveAttribute(
      'href',
      '/course/c1/period/p4/trends',
    );
    expect(screen.getByRole('link', { name: /add a course/i })).toBeInTheDocument();
  });
});
```

**Step 2 — Run, expect FAIL:**

```
npx vitest run src/pages/HomePage.test.tsx
```

Expect failures: the progress bar `role="progressbar"`, the `period-progress-fill-p4` testid, and the styled fill width don't exist yet on the dashboard.

**Step 3 — Minimal impl (edit REAL `src/pages/HomePage.tsx` — export `HomeDashboard`, style additively, keep existing testids/names):**

```tsx
import { Link } from 'react-router-dom';
import type { Course, Period } from '../types';
import {
  tokens,
  cardStyle,
  periodChipStyle,
  progressTrackStyle,
  progressFillStyle,
} from '../ui/theme';

export interface HomeDashboardProps {
  courses: Course[];
  periodsByCourse: Record<string, Period[]>;
  progressByPeriod: Record<string, { sent: number; total: number }>;
}

export function HomeDashboard({
  courses,
  periodsByCourse,
  progressByPeriod,
}: HomeDashboardProps) {
  return (
    <div style={{ display: 'grid', gap: tokens.space(2) }}>
      {courses.map((course) => {
        const periods = periodsByCourse[course.id] ?? [];
        return (
          <section key={course.id} style={cardStyle()} aria-label={course.name}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.space(1.5),
                flexWrap: 'wrap',
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18 }}>{course.name}</h2>
              {periods.map((p) => (
                <span key={p.id} style={periodChipStyle(false)}>
                  {p.label}
                </span>
              ))}
            </div>

            <div style={{ display: 'grid', gap: tokens.space(1.5), marginTop: tokens.space(2) }}>
              {periods.map((p) => {
                const prog = progressByPeriod[p.id] ?? { sent: 0, total: 0 };
                const pct =
                  prog.total === 0 ? 0 : Math.round((prog.sent / prog.total) * 100);
                return (
                  <div
                    key={p.id}
                    style={{
                      background: tokens.color.panelAlt,
                      border: `1px solid ${tokens.color.border}`,
                      borderRadius: tokens.radius.md,
                      padding: tokens.space(1.5),
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 14,
                      }}
                    >
                      <span data-testid={`period-progress-${p.id}`}>
                        {p.label} · {prog.sent} / {prog.total} sent
                      </span>
                      <span style={{ display: 'flex', gap: tokens.space(2) }}>
                        <Link
                          to={`/course/${course.id}/period/${p.id}/compose`}
                          style={{ color: tokens.color.teal, fontWeight: 600 }}
                        >
                          Write feedback →
                        </Link>
                        <Link
                          to={`/course/${course.id}/period/${p.id}/trends`}
                          style={{ color: tokens.color.subtle }}
                        >
                          Trends
                        </Link>
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${p.label} feedback progress`}
                      aria-valuenow={prog.sent}
                      aria-valuemax={prog.total}
                      style={{ ...progressTrackStyle(), marginTop: tokens.space(1) }}
                    >
                      <div
                        data-testid={`period-progress-fill-${p.id}`}
                        style={progressFillStyle(pct)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <Link
        to="/setup"
        style={{
          ...cardStyle(),
          borderStyle: 'dashed',
          textAlign: 'center',
          color: tokens.color.teal,
          fontWeight: 600,
        }}
      >
        + Add a course
      </Link>
    </div>
  );
}
```

Keep the existing default-exported `HomePage` wrapper (greeting + the `HomeDashboard`) intact; only its inner markup gains the styled dashboard. If `HomePage` already renders the dashboard inline, extract that JSX verbatim into `HomeDashboard` and have `HomePage` render `<HomeDashboard .../>` so the existing greeting/sign-out tests are unaffected.

**Step 4 — Run, expect PASS:**

```
npx vitest run src/pages/HomePage.test.tsx
```

Expect all HomePage tests green (new polish tests + the existing greeting/links tests from the home phase).

**Step 5 — Commit:**

```
git add src/pages/HomePage.tsx src/pages/HomePage.test.tsx
git commit -m "Polish HomePage dashboard: course cards, period chips, per-period progress bars

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task U4: Polish SetupPage (courses + periods)

Style the "Add a course" card and the existing-courses list with `cardStyle` + `periodChipStyle`. The period checkboxes (1–6), the "+ Add custom period" affordance, "Create course", and Rename/Archive/Delete keep their labels and roles.

**Step 1 — Failing test (append REAL code to `src/pages/SetupPage.test.tsx`):**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Course, Period } from '../types';
import { SetupView } from './SetupPage';

const courses: Course[] = [{ id: 'c1', name: '8th Grade U.S. History' }];
const periodsByCourse: Record<string, Period[]> = {
  c1: [{ id: 'p3', label: 'Period 3', order: 3 }],
};

describe('SetupView — B+C polish', () => {
  it('keeps the course-name field, period checkboxes and Create button queryable', () => {
    render(
      <MemoryRouter>
        <SetupView
          courses={[]}
          periodsByCourse={{}}
          onCreateCourse={() => {}}
          onRename={() => {}}
          onArchive={() => {}}
          onDelete={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('Course name')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '6' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add custom period/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create course' })).toBeInTheDocument();
  });

  it('renders existing courses as cards with their period chips and controls', () => {
    render(
      <MemoryRouter>
        <SetupView
          courses={courses}
          periodsByCourse={periodsByCourse}
          onCreateCourse={() => {}}
          onRename={() => {}}
          onArchive={() => {}}
          onDelete={() => {}}
        />
      </MemoryRouter>,
    );
    const card = screen.getByRole('region', { name: '8th Grade U.S. History' });
    expect(card).toHaveStyle({ background: '#15171c' });
    expect(screen.getByText('Period 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});
```

**Step 2 — Run, expect FAIL:**

```
npx vitest run src/pages/SetupPage.test.tsx
```

Expect failure: the existing-course block isn't a `region` with the course name as its accessible label and a panel background yet, so `getByRole('region', { name: ... })` / `toHaveStyle` fail.

**Step 3 — Minimal impl (edit REAL `src/pages/SetupPage.tsx`):** export a presentational `SetupView` that the data-wired `SetupPage` renders. Style additively:
- Wrap the "Add a course" form in `cardStyle()`; keep `<label>Course name</label>` + the 1–6 checkboxes (each `<label>` with the digit as text → accessible checkbox name), the "+ Add custom period" button, and "Create course" submit unchanged.
- Render each existing course as `<section role="region" aria-label={course.name} style={cardStyle()}>` containing the `<h2>{name}</h2>`, its periods mapped to `<span style={periodChipStyle(false)}>{p.label}</span>`, and the unchanged Rename / Archive / Delete buttons (Delete keeps `className="danger"` and the typed-confirmation gate).

Do not alter any handler names, the checkbox `name`/`value` digits, or the confirm flow — only wrap markup and add inline styles.

**Step 4 — Run, expect PASS:**

```
npx vitest run src/pages/SetupPage.test.tsx
```

Expect all SetupPage tests green (new polish tests + the existing create-course / rename / archive / delete-confirmation tests from the setup phase).

**Step 5 — Commit:**

```
git add src/pages/SetupPage.tsx src/pages/SetupPage.test.tsx
git commit -m "Polish SetupPage: course card form + existing-course cards with period chips

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task U5: Polish RosterPage (3 entry methods)

Give the per-period roster screen its B+C surface: the three entry methods (Upload CSV + Download template, Type manually, Paste a list) each become a `cardStyle` panel; the import preview and the saved-students table inherit the global table styling. All labels (`Upload a CSV…`, `Download template`, `Add student`, `Parse & add`) and the `RosterTable`/`ImportPreview` testids are preserved.

**Step 1 — Failing test (append REAL code to `src/pages/RosterPage.test.tsx`):**

```tsx
describe('RosterPage — B+C polish', () => {
  it('keeps the three roster-entry methods labelled and present', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter>
        <RosterPage deps={deps} />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('region', { name: /upload csv/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download template/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /type manually/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /paste a list/i })).toBeInTheDocument();
  });

  it('each entry-method region is a styled panel card', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter>
        <RosterPage deps={deps} />
      </MemoryRouter>,
    );
    const upload = await screen.findByRole('region', { name: /upload csv/i });
    expect(upload).toHaveStyle({ background: '#15171c' });
    expect(upload).toHaveStyle({ borderRadius: '14px' });
  });
});
```

**Step 2 — Run, expect FAIL:**

```
npx vitest run src/pages/RosterPage.test.tsx
```

Expect failure: the entry-method `<section>`s aren't `region`s with those `aria-label`s + `cardStyle` yet (the redesigned roster from the roster phase has the three methods but unstyled), so `getByRole('region', …)`/`toHaveStyle` fail.

**Step 3 — Minimal impl (edit REAL `src/pages/RosterPage.tsx` additively):** for the redesigned three-method roster section, set each method's wrapper to `<section role="region" aria-label="Upload CSV" style={cardStyle()}>` (and likewise `aria-label="Type manually"`, `aria-label="Paste a list"`), import `cardStyle` from `../ui/theme`, and lay the three cards out in a responsive grid:

```tsx
<div
  style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: tokens.space(2),
  }}
>
  {/* the three <section role="region" style={cardStyle()}> entry methods */}
</div>
```

Keep the `<input type="file">` + its `Upload a CSV…` label, the `Download template` button (and its blob-download handler), the manual `name`/`email` inputs + `Add student` button, the paste `<textarea>` + `Parse & add` button, and the `ImportPreview`/`RosterTable` children all exactly as the roster phase built them — only the wrappers gain the role/label/style.

**Step 4 — Run, expect PASS:**

```
npx vitest run src/pages/RosterPage.test.tsx
```

Expect all RosterPage tests green (new polish tests + the existing CSV-upload / template-download / manual-add / paste-parse / save tests from the roster phase).

**Step 5 — Commit:**

```
git add src/pages/RosterPage.tsx src/pages/RosterPage.test.tsx
git commit -m "Polish RosterPage: three entry-method cards on the B+C surface

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task U6: Polish ComposePage + ComposeHistoryPanel

Bring the compose flow to mockup quality: breadcrumb header, a `progressTrack` roster bar (keeping the `roster-progress` testid), and the inline **ComposeHistoryPanel** styled as a calm `cardStyle` list of dated prior rounds. `{slot}` tokens in shown history use `slotTokenStyle`. The `ComposeScreen` (already styled) and the `aria-pressed` roster buttons are untouched.

**Step 1 — Failing test (append REAL code to `src/compose/ComposeHistoryPanel.test.tsx`):**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FeedbackHistoryEntry } from '../types';
import { ComposeHistoryPanel } from './ComposeHistoryPanel';

const history: FeedbackHistoryEntry[] = [
  {
    studentId: 's1',
    periodId: 'p4',
    courseId: 'c1',
    yearId: 'y1',
    sentAt: 1_700_000_000_000,
    gradingPeriod: 'Q1',
    finalText: 'Speak up more in debates.',
    tags: { areas: ['discussion'], sentiments: ['growth'], standards: [] },
    usedEntries: ['b1'],
  },
];

describe('ComposeHistoryPanel — B+C polish', () => {
  it('shows a dated, grading-period-stamped recap line for each prior round', () => {
    render(<ComposeHistoryPanel history={history} />);
    const panel = screen.getByRole('region', { name: /feedback history/i });
    expect(panel).toHaveStyle({ background: '#15171c' });
    expect(screen.getByText(/Q1/)).toBeInTheDocument();
    expect(screen.getByText(/Speak up more in debates\./)).toBeInTheDocument();
  });

  it('renders an empty-state line when there is no prior history', () => {
    render(<ComposeHistoryPanel history={[]} />);
    expect(screen.getByText(/no prior feedback/i)).toBeInTheDocument();
  });
});
```

**Step 2 — Run, expect FAIL:**

```
npx vitest run src/compose/ComposeHistoryPanel.test.tsx
```

Expect failure: the panel isn't a `region` named "feedback history" with a panel background, so `getByRole('region', …)`/`toHaveStyle` fail.

**Step 3 — Minimal impl.** Edit REAL `src/compose/ComposeHistoryPanel.tsx` additively — wrap the existing list in `<section role="region" aria-label="Feedback history" style={cardStyle()}>`, render each entry as a dated recap (`{new Date(e.sentAt)...}` · `{e.gradingPeriod}` — `{e.finalText}`) styled with `tokens`, and keep the empty-state "No prior feedback for this student yet." line:

```tsx
import type { FeedbackHistoryEntry } from '../types';
import { tokens, cardStyle } from '../ui/theme';

function fmt(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ComposeHistoryPanel({ history }: { history: FeedbackHistoryEntry[] }) {
  return (
    <section role="region" aria-label="Feedback history" style={cardStyle()}>
      <div
        style={{
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: tokens.color.muted,
          marginBottom: tokens.space(1),
        }}
      >
        Feedback history
      </div>
      {history.length === 0 ? (
        <p style={{ color: tokens.color.muted, fontSize: 13, margin: 0 }}>
          No prior feedback for this student yet.
        </p>
      ) : (
        <ul style={{ display: 'grid', gap: tokens.space(1), margin: 0 }}>
          {history.map((e, i) => (
            <li key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>
              <span style={{ color: tokens.color.teal, fontFamily: tokens.mono }}>
                {fmt(e.sentAt)} · {e.gradingPeriod}
              </span>{' '}
              <span style={{ color: tokens.color.subtle }}>— {e.finalText}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

Then edit REAL `src/pages/ComposePage.tsx` additively: convert the `<p data-testid="roster-progress">` count into a count **plus** a `progressTrack`/`progressFill` bar (keep the testid and the `doneCount / total` text node exactly), wrap the page in the breadcrumb header, and keep the `aria-pressed` roster buttons + `ComposeScreen` mount unchanged.

**Step 4 — Run, expect PASS:**

```
npx vitest run src/compose/ComposeHistoryPanel.test.tsx src/pages/ComposePage.test.tsx
```

Expect all ComposeHistoryPanel and ComposePage tests green (new polish tests + the existing roster-progress / auto-save / next-student tests).

**Step 5 — Commit:**

```
git add src/compose/ComposeHistoryPanel.tsx src/compose/ComposeHistoryPanel.test.tsx src/pages/ComposePage.tsx
git commit -m "Polish ComposePage + inline ComposeHistoryPanel with cards and progress bar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task U7: Polish Review/Send + grading-period step

Polish the review → send screen: the grading-period selector (Q1–Q4/S1/S2/EOY + optional label) renders as `chipStyle` pills sourced from `src/feedback/taxonomy.ts`, and the screen reuses the already-polished `SendStepper` for copy-paste. The send-progress `role="status"` / `progressbar` and the `progress-sent-count` testid are preserved.

**Step 1 — Failing test (append REAL code to `src/pages/ReviewSendPage.test.tsx`):**

```tsx
import { GRADING_PERIODS } from '../feedback/taxonomy';

describe('ReviewSendPage — grading-period polish', () => {
  it('renders a chip for every grading period from the taxonomy config', async () => {
    const deps = makeDeps(); // existing helper in this file
    render(
      <MemoryRouter initialEntries={['/review/batch-1']}>
        <Routes>
          <Route path="/review/:batchId" element={<ReviewSendPage deps={deps} />} />
        </Routes>
      </MemoryRouter>,
    );
    for (const gp of GRADING_PERIODS) {
      expect(
        await screen.findByRole('button', { name: gp }),
      ).toBeInTheDocument();
    }
  });

  it('selecting a grading-period chip marks it pressed (aria-pressed)', async () => {
    const deps = makeDeps();
    render(
      <MemoryRouter initialEntries={['/review/batch-1']}>
        <Routes>
          <Route path="/review/:batchId" element={<ReviewSendPage deps={deps} />} />
        </Routes>
      </MemoryRouter>,
    );
    const q2 = await screen.findByRole('button', { name: 'Q2' });
    fireEvent.click(q2);
    expect(q2).toHaveAttribute('aria-pressed', 'true');
  });
});
```

(`Route`/`Routes` imported from `react-router-dom`; `makeDeps` is the existing factory in this test file.)

**Step 2 — Run, expect FAIL:**

```
npx vitest run src/pages/ReviewSendPage.test.tsx
```

Expect failure: the grading-period chips don't exist or aren't `aria-pressed` toggle buttons named after `GRADING_PERIODS` yet.

**Step 3 — Minimal impl (edit REAL `src/pages/ReviewSendPage.tsx` additively):** import `{ GRADING_PERIODS }` from `../feedback/taxonomy` and `{ chipStyle, tokens }` from `../ui/theme` (never hardcode the list). Render the selector above the send step:

```tsx
import { GRADING_PERIODS } from '../feedback/taxonomy';
import { chipStyle, tokens } from '../ui/theme';

// inside the component, with existing [gradingPeriod, setGradingPeriod] state:
<fieldset style={{ border: 'none', padding: 0, margin: `0 0 ${tokens.space(2)}px` }}>
  <legend style={{ fontSize: 13, color: tokens.color.muted, padding: 0 }}>
    Grading period for this round
  </legend>
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
    {GRADING_PERIODS.map((gp) => (
      <button
        key={gp}
        type="button"
        aria-pressed={gradingPeriod === gp}
        onClick={() => setGradingPeriod(gp)}
        style={chipStyle(gradingPeriod === gp)}
      >
        {gp}
      </button>
    ))}
  </div>
</fieldset>
```

Keep the optional free-text label input, the send-progress `role="status"` block with `data-testid="progress-sent-count"`, and the `<SendStepper .../>` mount exactly as the send phase built them — only the grading-period chips are added/styled.

**Step 4 — Run, expect PASS:**

```
npx vitest run src/pages/ReviewSendPage.test.tsx
```

Expect all ReviewSendPage tests green (new grading-period chip tests + the existing send/mark-sent/progress tests).

**Step 5 — Commit:**

```
git add src/pages/ReviewSendPage.tsx src/pages/ReviewSendPage.test.tsx
git commit -m "Polish Review/Send: grading-period chips from taxonomy config + B+C surface

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task U8: Polish per-student History page + TrendsPage

Final two surfaces: the per-student **history page** (chronological cards across grading periods, with `periodChipStyle` grading-period chips), and the **TrendsPage** (per-period/per-course aggregates as cards with `chipStyle` area/sentiment chips and `progressTrack`/`progressFill` count bars). Both read the grading-period list and tag categories from `src/feedback/taxonomy.ts`; all existing testids/roles for the aggregate counts are preserved.

**Step 1 — Failing test (append REAL code to `src/pages/TrendsPage.test.tsx`):**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { FeedbackHistoryEntry } from '../types';
import { TrendsView } from './TrendsPage';

const history: FeedbackHistoryEntry[] = [
  {
    studentId: 's1', periodId: 'p4', courseId: 'c1', yearId: 'y1',
    sentAt: 1_700_000_000_000, gradingPeriod: 'Q1',
    finalText: 'x',
    tags: { areas: ['cer'], sentiments: ['growth'], standards: [] },
    usedEntries: ['b1'],
  },
  {
    studentId: 's2', periodId: 'p4', courseId: 'c1', yearId: 'y1',
    sentAt: 1_700_000_100_000, gradingPeriod: 'Q1',
    finalText: 'y',
    tags: { areas: ['cer'], sentiments: ['strength'], standards: [] },
    usedEntries: ['b2'],
  },
];

describe('TrendsView — B+C polish', () => {
  it('shows area-count cards with a bar, keeping the count testid', () => {
    render(
      <MemoryRouter>
        <TrendsView history={history} scopeLabel="Period 4" />
      </MemoryRouter>,
    );
    const card = screen.getByRole('region', { name: /by area/i });
    expect(card).toHaveStyle({ background: '#15171c' });
    const cer = within(card).getByTestId('area-count-cer');
    expect(cer).toHaveTextContent('cer');
    expect(cer).toHaveTextContent('2');
    expect(within(card).getByRole('progressbar', { name: /cer/i })).toHaveAttribute(
      'aria-valuenow',
      '2',
    );
  });

  it('shows the strength-vs-growth balance with its count testids', () => {
    render(
      <MemoryRouter>
        <TrendsView history={history} scopeLabel="Period 4" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('sentiment-count-strength')).toHaveTextContent('1');
    expect(screen.getByTestId('sentiment-count-growth')).toHaveTextContent('1');
  });
});
```

**Step 2 — Run, expect FAIL:**

```
npx vitest run src/pages/TrendsPage.test.tsx
```

Expect failure: the trends aggregation may already exist as logic, but the `region`/`progressbar`/card styling and the `area-count-*` / `sentiment-count-*` testids on a styled `TrendsView` are not present yet.

**Step 3 — Minimal impl.** Edit REAL `src/pages/TrendsPage.tsx`: export a presentational `TrendsView({ history, scopeLabel })` that calls the existing pure aggregation (the unit-tested `count by area/sentiment/standard` helper from the trends phase — import it, do not re-implement) and renders:
- An "By area" `<section role="region" aria-label="By area" style={cardStyle()}>` with one row per area: `<div data-testid={`area-count-${area}`}>` showing the area name + count, plus a `role="progressbar"` `aria-label={area}` `aria-valuenow={count}` bar using `progressTrackStyle`/`progressFillStyle` (pct = count / maxCount).
- A "Strength vs growth" card with `<span data-testid="sentiment-count-strength">`/`growth`/`neutral` counts rendered as `chipStyle` pills.
- The grading-period axis using `GRADING_PERIODS` from `../feedback/taxonomy` for column order.

Then edit REAL `src/pages/StudentHistoryPage.tsx` additively: wrap each chronological round in `cardStyle`, stamp its grading period with `periodChipStyle`, keep the existing date/label/finalText text nodes and any testids from the history phase unchanged.

**Step 4 — Run, expect PASS:**

```
npx vitest run src/pages/TrendsPage.test.tsx src/pages/StudentHistoryPage.test.tsx
```

Expect all TrendsPage and StudentHistoryPage tests green (new polish tests + the existing aggregation / chronological-render tests).

**Step 5 — Full-suite confirmation + commit.** Run the entire default suite to prove the polish pass left all 263 tests (plus the polish additions) green:

```
npx vitest run
```

Expect every test green.

```
git add src/pages/TrendsPage.tsx src/pages/TrendsPage.test.tsx src/pages/StudentHistoryPage.tsx
git commit -m "Polish History page + TrendsPage: chronological cards, area/sentiment count bars

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

**Phase notes for the assembler:**
- Task 1 must land first — Tasks 2–8 import its helpers (`cardStyle`, `progressTrackStyle`, `progressFillStyle`, `breadcrumbStyle`, `breadcrumbSepStyle`, `navBarStyle`, `periodChipStyle`).
- Every screen task is purely additive: it wraps/decorates the markup that earlier phases built and re-runs that screen's existing test file. No role, `aria-label`, `aria-pressed`, label text, link name, or `data-testid` that a test queries is renamed or removed.
- Component file paths assume the earlier-phase locations: `src/nav/NavBar.tsx`, `src/nav/Breadcrumbs.tsx`, `src/pages/HomePage.tsx`, `src/pages/SetupPage.tsx`, `src/pages/RosterPage.tsx`, `src/pages/ComposePage.tsx`, `src/compose/ComposeHistoryPanel.tsx`, `src/pages/ReviewSendPage.tsx`, `src/pages/TrendsPage.tsx`, `src/pages/StudentHistoryPage.tsx`. If a redesign phase placed any of these elsewhere, adjust the import path only — the styling logic is unchanged.
- The taxonomy import (`GRADING_PERIODS`, tag categories) is always from `src/feedback/taxonomy.ts`; the grading-period list and sentiment labels are never hardcoded in a screen.

---

