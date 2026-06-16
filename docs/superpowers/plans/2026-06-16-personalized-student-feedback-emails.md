# Personalized Student Feedback Emails — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-teacher web app that turns a CSV roster + a tagged comment-template bank into personalized, reviewable, batch-sent end-of-year emails to students, with work saved across sessions.

**Architecture:** A Vite + React + TypeScript single-page app talking directly to Firebase (Auth + Firestore + Hosting). No self-hosted server. Google sign-in doubles as login and grants the Gmail-send scope; emails send from the browser as the teacher (Mode A), with a copy-paste fallback (Mode B) if the district blocks third-party OAuth. All student data is private-per-teacher, enforced by Firestore Security Rules. Tricky logic (CSV parsing, template slot-filling, the batch-send state machine, grammar checks) is pure and unit-tested first (TDD).

**Tech Stack:** Vite, React 18, TypeScript, Vitest + React Testing Library, Firebase JS SDK v9+ (modular), @firebase/rules-unit-testing, PapaParse.

**Audience/content:** 8th-grade U.S. History, teacher "Mr. B.". The seed comment bank speaks this room's language — CERs/argumentation, discussion & debate, research & sources, collaboration & projects, professionalism — in Mr. B.'s first-person voice.

**Design language:** The "B + C blend" — Direction B's calm dark canvas (deep slate surfaces, one soft teal accent `#5fb8a8`, generous spacing, hierarchy via type) carrying Direction C's efficiency affordances (keyboard-shortcut chips like `⌘↵`, color-coded roster status chips, monospace `{slot}` tokens). B owns the surface; C owns the interaction mechanics.

---

## Canonical Data Model (single source of truth)

All collections root under the signed-in teacher's `uid`:

```
teachers/{uid}/classes/{classId}                         ← ClassMeta: name, period, semester, unit
teachers/{uid}/classes/{classId}/students/{studentId}    ← Student: name, email, period
teachers/{uid}/bankEntries/{entryId}                     ← BankEntry: templateText, slots[], tags{}
teachers/{uid}/batches/{batchId}                         ← Batch: classId, sharedHeader, status
teachers/{uid}/batches/{batchId}/messages/{studentId}    ← MessageDraft: usedEntries[], slotValues{}, finalText, status
```

**Security rules** (owned by Task F9, the single `firestore.rules` file):
```
match /teachers/{ownerUid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == ownerUid;
}
match /{document=**} { allow read, write: if false; }   // default deny
```

**Shared types** live ONLY in `src/types.ts` (Task F0): `Student`, `ClassMeta`, `SlotKind`, `Slot`, `BankTags`, `BankEntry`, `MessageDraft`, `Batch`, and `AUTO_SLOT_KEYS = ['name','semester']`. Every other module imports these — never re-declares them.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/types.ts` | Canonical shared types (the only place they're declared). |
| `src/firebase/config.ts` | Initialize Firebase app/auth/db; export `{ app, auth, db }`. |
| `src/auth/*` | Allowlist guard, Google sign-in (Gmail-send scope), `useAuth`, `RequireAuth` route guard. |
| `src/landing/*` | Public landing page (the only thing signed-out visitors see). |
| `src/roster/*` | CSV parsing (`parseRoster`, `mapColumns`, normalizers), `saveStudents`, classes data fns, `ClassesScreen`, `ImportPreview`, `RosterTable`. |
| `src/bank/*` | `extractSlots`, bank types/factory, `filterBankEntries`, Firestore CRUD, `BankEntryForm`, `BankList`, seed bank. |
| `src/compose/*` | `fillSlots`, `assembleMessage`, `rosterProgress`, `filterBankByTags`, `useComposeMessage`, fill-slot UI, batch data fns, `useDebouncedSave`, `MessageBuilder`, `ComposeScreen`. |
| `src/send/*` | Grammar checks, batch-send state machine + runner, Gmail adapter/sender, `isAuthError`, `ReviewScreen` (+ container), send-progress panel, Mode B copy-paste panel. |
| `firestore.rules` | The single owner-only rules file (+ default deny). |
| `src/App.tsx`, `src/main.tsx` | Router wiring (landing + guarded app). |

---

## Build Order

Tasks are renumbered with a step prefix and run in dependency order. The repair tasks (canonical types, class/batch creation, compose↔bank wiring, error handling, review→send handoff) are woven into their build steps below, replacing the earlier stubbed versions. Where a "CORRECTED" task appears, it supersedes any earlier same-named task — use the corrected path (`teachers/{uid}/…`).

- **Step F — Foundation** (scaffold, types, Firebase, auth, landing, route guard, rules)
- **Step R — Roster** (classes data + screen, CSV parse, import preview, save, roster view)
- **Step K — Bank** (slot extraction, types, filter, CRUD, form, list, **seed bank**)
- **Step C — Compose** (slot-fill, assemble, progress, batch data, compose↔bank wiring, builder, screen)
- **Step S — Send** (grammar, state machine, Gmail adapter, review→send handoff, Mode A panel, Mode B fallback, re-auth, disable-when-sent)

---


## Step F — Foundation

### Task F0: Canonical shared types (src/types.ts)

This task runs immediately after the scaffold (Task 1) and before every other step. It establishes the single source of truth for shared shapes. Every later task imports from `src/types.ts` and never re-declares these interfaces.

**Step 1 — Write the failing test** (`src/types.test.ts`).

This is a compile-time + runtime shape assertion: we construct one literal of each interface (so TypeScript fails to compile if a field is missing or mistyped) and assert key presence at runtime. The `import` of `../types` is itself the first thing that fails, because the file does not exist yet.

```typescript
// src/types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  Student,
  ClassMeta,
  SlotKind,
  Slot,
  BankTags,
  BankEntry,
  MessageDraft,
  Batch,
} from './types';

describe('canonical shared types (src/types.ts)', () => {
  it('Student has id/name/email and optional period', () => {
    const s: Student = { id: 's1', name: 'Carlos', email: 'carlos@example.com', period: '3' };
    expect(Object.keys(s)).toEqual(expect.arrayContaining(['id', 'name', 'email']));
    expect(s.id).toBe('s1');
    expect(s.name).toBe('Carlos');
    expect(s.email).toBe('carlos@example.com');

    // period is optional
    const minimal: Student = { id: 's2', name: 'Dana', email: 'dana@example.com' };
    expect(minimal.period).toBeUndefined();
  });

  it('ClassMeta has id/name and optional period/semester/unit', () => {
    const c: ClassMeta = {
      id: 'c1',
      name: 'Period 3 Biology',
      period: '3',
      semester: 'Spring',
      unit: 'Genetics',
    };
    expect(Object.keys(c)).toEqual(expect.arrayContaining(['id', 'name']));
    expect(c.id).toBe('c1');
    expect(c.name).toBe('Period 3 Biology');

    const minimal: ClassMeta = { id: 'c2', name: 'Period 1 Chemistry' };
    expect(minimal.semester).toBeUndefined();
  });

  it('SlotKind is exactly auto | fill', () => {
    const a: SlotKind = 'auto';
    const f: SlotKind = 'fill';
    expect([a, f]).toEqual(['auto', 'fill']);
  });

  it('Slot has key/kind and optional hint', () => {
    const slot: Slot = { key: 'name', kind: 'auto' };
    expect(Object.keys(slot)).toEqual(expect.arrayContaining(['key', 'kind']));
    expect(slot.key).toBe('name');
    expect(slot.kind).toBe('auto');

    const withHint: Slot = { key: 'favorite_lab', kind: 'fill', hint: 'their best lab' };
    expect(withHint.hint).toBe('their best lab');
  });

  it('BankTags has optional type/area/objective/tone', () => {
    const tags: BankTags = { type: 'success', area: 'lab', objective: 'precision', tone: 'warm' };
    expect(tags.type).toBe('success');
    expect(tags.area).toBe('lab');
    expect(tags.objective).toBe('precision');
    expect(tags.tone).toBe('warm');

    const empty: BankTags = {};
    expect(empty.type).toBeUndefined();
  });

  it('BankEntry has id/templateText/slots/tags', () => {
    const entry: BankEntry = {
      id: 'b1',
      templateText: 'Hi {name}, this {semester} you grew in {area}.',
      slots: [
        { key: 'name', kind: 'auto' },
        { key: 'semester', kind: 'auto' },
        { key: 'area', kind: 'fill', hint: 'area of growth' },
      ],
      tags: { type: 'growth', tone: 'encouraging' },
    };
    expect(Object.keys(entry)).toEqual(
      expect.arrayContaining(['id', 'templateText', 'slots', 'tags']),
    );
    expect(entry.slots).toHaveLength(3);
    expect(entry.slots[0].kind).toBe('auto');
    expect(entry.tags.type).toBe('growth');
  });

  it('MessageDraft has studentId/name/usedEntries/slotValues/finalText/status', () => {
    const draft: MessageDraft = {
      studentId: 's1',
      name: 'Carlos',
      usedEntries: ['b1', 'b2'],
      slotValues: { area: 'genetics' },
      finalText: 'Hi Carlos, this Spring you grew in genetics.',
      status: 'draft',
    };
    expect(Object.keys(draft)).toEqual(
      expect.arrayContaining([
        'studentId',
        'name',
        'usedEntries',
        'slotValues',
        'finalText',
        'status',
      ]),
    );
    expect(draft.usedEntries).toEqual(['b1', 'b2']);
    expect(draft.slotValues.area).toBe('genetics');

    // status is the draft|sent|failed union
    const sent: MessageDraft['status'] = 'sent';
    const failed: MessageDraft['status'] = 'failed';
    expect([draft.status, sent, failed]).toEqual(['draft', 'sent', 'failed']);
  });

  it('Batch has id/classId/sharedHeader/status', () => {
    const batch: Batch = {
      id: 'batch1',
      classId: 'c1',
      sharedHeader: 'End-of-year note',
      status: 'draft',
    };
    expect(Object.keys(batch)).toEqual(
      expect.arrayContaining(['id', 'classId', 'sharedHeader', 'status']),
    );

    // status is the draft|sending|sent union
    const sending: Batch['status'] = 'sending';
    const done: Batch['status'] = 'sent';
    expect([batch.status, sending, done]).toEqual(['draft', 'sending', 'sent']);
  });
});
```

**Step 2 — Run the test, expect FAIL.**

```bash
npx vitest run src/types.test.ts
```

Expected: FAIL. The suite cannot even load — `src/types.ts` does not exist, so the `import ... from './types'` resolution errors out (`Failed to resolve import "./types"` / `Cannot find module './types'`), and zero tests run.

**Step 3 — Minimal implementation** (`src/types.ts`).

Exactly the canonical interfaces, nothing more. This is the one and only declaration of these shapes in the codebase.

```typescript
// src/types.ts
// Canonical shared types — the SINGLE source of truth.
// Every other module imports from here; these shapes are never re-declared elsewhere.

export interface Student {
  id: string;
  name: string;
  email: string;
  period?: string;
}

export interface ClassMeta {
  id: string;
  name: string;
  period?: string;
  semester?: string;
  unit?: string;
}

export type SlotKind = 'auto' | 'fill';

export interface Slot {
  key: string;
  kind: SlotKind;
  hint?: string;
}

export interface BankTags {
  type?: string;
  area?: string;
  objective?: string;
  tone?: string;
}

export interface BankEntry {
  id: string;
  templateText: string;
  slots: Slot[];
  tags: BankTags;
}

export interface MessageDraft {
  studentId: string;
  name: string;
  usedEntries: string[];
  slotValues: Record<string, string>;
  finalText: string;
  status: 'draft' | 'sent' | 'failed';
}

export interface Batch {
  id: string;
  classId: string;
  sharedHeader: string;
  status: 'draft' | 'sending' | 'sent';
}

// AUTO slot keys are exactly: name, semester.
// Exported as a const tuple so slot-filling logic (later tasks) references one definition.
export const AUTO_SLOT_KEYS = ['name', 'semester'] as const;
export type AutoSlotKey = (typeof AUTO_SLOT_KEYS)[number];
```

**Step 4 — Run the test, expect PASS.**

```bash
npx vitest run src/types.test.ts
```

Expected: PASS — all 8 tests green. The literals compile (every required field present, unions correct) and the runtime key-presence assertions hold.

**Step 5 — Commit.**

```bash
git add src/types.ts src/types.test.ts
git commit -m "Add canonical shared types (src/types.ts)

Single source of truth for Student, ClassMeta, Slot/SlotKind, BankTags,
BankEntry, MessageDraft, and Batch. All later tasks import from here and
never re-declare these shapes. AUTO slot keys are exactly name, semester.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task F1: Scaffold Vite + React + TS project with a passing Vitest smoke test

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.setup.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/App.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the app shell', () => {
    render(<App />);
    expect(screen.getByText('Student Feedback Emails')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `npm install && npx vitest run src/App.test.tsx`
  - Expected: FAIL — `npm install` succeeds but the test errors because `src/App.tsx` does not exist yet (`Failed to resolve import "./App"`).

- [ ] **Step 3: Write minimal implementation**

Create `package.json`:

```json
{
  "name": "student-feedback-emails",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "firebase": "^10.12.0",
    "papaparse": "^5.4.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1"
  },
  "devDependencies": {
    "@firebase/rules-unit-testing": "^3.0.3",
    "@testing-library/jest-dom": "^6.4.5",
    "@testing-library/react": "^15.0.7",
    "@testing-library/user-event": "^14.5.2",
    "@types/papaparse": "^5.3.14",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.1.0",
    "typescript": "^5.4.5",
    "vite": "^5.2.11",
    "vitest": "^1.6.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vitest.setup.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    css: false,
  },
});
```

Create `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Student Feedback Emails</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/App.tsx`:

```tsx
export default function App() {
  return (
    <div>
      <h1>Student Feedback Emails</h1>
    </div>
  );
}
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/App.test.tsx`
  - Expected: PASS — 1 test passes; the toolchain (Vite + React + TS + Vitest + RTL) is proven.

- [ ] **Step 5: Commit**
  - Run: `git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts vitest.setup.ts index.html src/main.tsx src/App.tsx src/App.test.tsx && git commit -m "Scaffold Vite+React+TS app with passing Vitest smoke test"`

---

### Task F2: Firebase config module reading env vars and initializing app/auth/firestore

**Files:**
- Create: `src/firebase/config.ts`
- Create: `src/env.d.ts`
- Create: `.env.example`
- Modify: `.gitignore` (add `.env.local`)
- Test: `src/firebase/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/firebase/config.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Firebase SDK so we test our wiring, not the network.
const initializeApp = vi.fn(() => ({ name: 'test-app' }));
const getApps = vi.fn(() => [] as unknown[]);
const getApp = vi.fn(() => ({ name: 'existing-app' }));
const getAuth = vi.fn(() => ({ kind: 'auth' }));
const getFirestore = vi.fn(() => ({ kind: 'firestore' }));

vi.mock('firebase/app', () => ({ initializeApp, getApps, getApp }));
vi.mock('firebase/auth', () => ({ getAuth }));
vi.mock('firebase/firestore', () => ({ getFirestore }));

describe('firebase config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    getApps.mockReturnValue([]);
  });

  it('initializes the app with config from import.meta.env', async () => {
    const { app, auth, db } = await import('./config');
    expect(initializeApp).toHaveBeenCalledTimes(1);
    const passedConfig = initializeApp.mock.calls[0][0] as Record<string, unknown>;
    expect(passedConfig).toHaveProperty('apiKey');
    expect(passedConfig).toHaveProperty('projectId');
    expect(getAuth).toHaveBeenCalledWith(app);
    expect(getFirestore).toHaveBeenCalledWith(app);
    expect(auth).toEqual({ kind: 'auth' });
    expect(db).toEqual({ kind: 'firestore' });
  });

  it('reuses an existing app instead of re-initializing', async () => {
    getApps.mockReturnValue([{ name: 'existing-app' }]);
    await import('./config');
    expect(initializeApp).not.toHaveBeenCalled();
    expect(getApp).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/firebase/config.test.ts`
  - Expected: FAIL — `Failed to resolve import "./config"` because `src/firebase/config.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_TEACHER_ALLOWLIST: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Create `src/firebase/config.ts`:

```ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize once; HMR / repeated imports must not re-init.
export const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
```

Create `.env.example`:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:abc123
VITE_TEACHER_ALLOWLIST=teacher@example.com
```

Modify `.gitignore` — append these lines so local secrets and build output are never committed:

```
node_modules
dist
.env.local
.env
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/firebase/config.test.ts`
  - Expected: PASS — 2 tests pass; config is read from env and the app is initialized exactly once (reused otherwise).

- [ ] **Step 5: Commit**
  - Run: `git add src/firebase/config.ts src/firebase/config.test.ts src/env.d.ts .env.example .gitignore && git commit -m "Add Firebase config module wiring app/auth/firestore from env vars"`

---

### Task F3: Email allowlist guard (pure function)

**Files:**
- Create: `src/auth/allowlist.ts`
- Test: `src/auth/allowlist.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/auth/allowlist.test.ts
import { describe, it, expect } from 'vitest';
import { isEmailAllowed, parseAllowlist } from './allowlist';

describe('parseAllowlist', () => {
  it('splits a comma-separated env string, trims, lowercases, drops blanks', () => {
    expect(parseAllowlist(' Teacher@Example.com , extra@x.com ,')).toEqual([
      'teacher@example.com',
      'extra@x.com',
    ]);
  });

  it('returns an empty list for undefined or empty input', () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist('')).toEqual([]);
  });
});

describe('isEmailAllowed', () => {
  const allow = ['teacher@example.com'];

  it('allows an exact match regardless of case/whitespace', () => {
    expect(isEmailAllowed('  TEACHER@example.com ', allow)).toBe(true);
  });

  it('rejects a non-listed email', () => {
    expect(isEmailAllowed('stranger@example.com', allow)).toBe(false);
  });

  it('rejects null/empty email', () => {
    expect(isEmailAllowed(null, allow)).toBe(false);
    expect(isEmailAllowed('', allow)).toBe(false);
  });

  it('rejects everything when the allowlist is empty', () => {
    expect(isEmailAllowed('teacher@example.com', [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/auth/allowlist.test.ts`
  - Expected: FAIL — `Failed to resolve import "./allowlist"` because `src/auth/allowlist.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/auth/allowlist.ts`:

```ts
/**
 * Parse the comma-separated VITE_TEACHER_ALLOWLIST env string into a
 * normalized (trimmed, lowercased, non-empty) list of allowed emails.
 */
export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

/**
 * True only if `email` exactly matches an entry in `allowlist`
 * (case-insensitive). Empty allowlist allows no one.
 */
export function isEmailAllowed(
  email: string | null | undefined,
  allowlist: string[],
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return allowlist.includes(normalized);
}
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/auth/allowlist.test.ts`
  - Expected: PASS — 6 assertions across the two suites pass.

- [ ] **Step 5: Commit**
  - Run: `git add src/auth/allowlist.ts src/auth/allowlist.test.ts && git commit -m "Add email allowlist parse/check helpers"`

---

### Task F4: Auth service — Google sign-in requesting the Gmail-send scope

**Files:**
- Create: `src/auth/authService.ts`
- Test: `src/auth/authService.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/auth/authService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mock firebase/auth ---
const signInWithPopup = vi.fn();
const signOut = vi.fn();

class FakeGoogleProvider {
  scopes: string[] = [];
  params: Record<string, string> = {};
  addScope(s: string) {
    this.scopes.push(s);
  }
  setCustomParameters(p: Record<string, string>) {
    this.params = p;
  }
}

vi.mock('firebase/auth', () => ({
  signInWithPopup,
  signOut,
  GoogleAuthProvider: FakeGoogleProvider,
}));

// --- Mock our firebase config so importing authService doesn't init real Firebase ---
vi.mock('../firebase/config', () => ({ auth: { kind: 'auth' } }));

import {
  GMAIL_SEND_SCOPE,
  signInWithGoogle,
  signOutTeacher,
} from './authService';

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the Gmail-send scope on the provider', async () => {
    signInWithPopup.mockResolvedValue({ user: { email: 't@x.com' } });
    await signInWithGoogle();

    const provider = signInWithPopup.mock.calls[0][1] as FakeGoogleProvider;
    expect(provider.scopes).toContain(GMAIL_SEND_SCOPE);
    expect(GMAIL_SEND_SCOPE).toBe(
      'https://www.googleapis.com/auth/gmail.send',
    );
  });

  it('passes the configured auth instance to signInWithPopup', async () => {
    signInWithPopup.mockResolvedValue({ user: { email: 't@x.com' } });
    await signInWithGoogle();
    expect(signInWithPopup.mock.calls[0][0]).toEqual({ kind: 'auth' });
  });

  it('returns the signed-in user', async () => {
    const user = { email: 't@x.com', uid: 'u1' };
    signInWithPopup.mockResolvedValue({ user });
    await expect(signInWithGoogle()).resolves.toEqual(user);
  });

  it('delegates sign-out to firebase signOut with the auth instance', async () => {
    signOut.mockResolvedValue(undefined);
    await signOutTeacher();
    expect(signOut).toHaveBeenCalledWith({ kind: 'auth' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/auth/authService.test.ts`
  - Expected: FAIL — `Failed to resolve import "./authService"` because `src/auth/authService.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/auth/authService.ts`:

```ts
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase/config';

// Scope that lets the app send mail as the teacher (Send Flow, Mode A).
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

/**
 * Open the Google sign-in popup, requesting the Gmail-send scope in the same
 * step as login. Resolves with the signed-in user.
 */
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.addScope(GMAIL_SEND_SCOPE);
  // Always show the account chooser so the right Workspace account is used.
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  return result.user;
}

/** Sign the teacher out. */
export async function signOutTeacher(): Promise<void> {
  await signOut(auth);
}
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/auth/authService.test.ts`
  - Expected: PASS — 4 tests pass; the Gmail-send scope is requested and the configured auth instance is used.

- [ ] **Step 5: Commit**
  - Run: `git add src/auth/authService.ts src/auth/authService.test.ts && git commit -m "Add Google sign-in service requesting Gmail-send scope"`

---

### Task F5: Auth state hook (`useAuth`) with allowlist enforcement

**Files:**
- Create: `src/auth/useAuth.tsx`
- Test: `src/auth/useAuth.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/auth/useAuth.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// --- Mock firebase/auth: capture the onAuthStateChanged callback ---
let authCallback: ((user: unknown) => void) | null = null;
const onAuthStateChanged = vi.fn((_auth, cb: (u: unknown) => void) => {
  authCallback = cb;
  return () => {}; // unsubscribe
});
const signOut = vi.fn(() => Promise.resolve());

vi.mock('firebase/auth', () => ({ onAuthStateChanged, signOut }));
vi.mock('../firebase/config', () => ({ auth: { kind: 'auth' } }));

// allowlist contains only the teacher
vi.mock('./allowlist', () => ({
  parseAllowlist: () => ['teacher@example.com'],
  isEmailAllowed: (email: string | null | undefined, list: string[]) =>
    !!email && list.includes(email.toLowerCase()),
}));

import { AuthProvider, useAuth } from './useAuth';

function Probe() {
  const { status, user } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authCallback = null;
  });

  it('starts in the loading state before Firebase reports', () => {
    renderProbe();
    expect(screen.getByTestId('status').textContent).toBe('loading');
  });

  it('is signed-out when Firebase reports no user', () => {
    renderProbe();
    act(() => authCallback!(null));
    expect(screen.getByTestId('status').textContent).toBe('signedOut');
    expect(screen.getByTestId('email').textContent).toBe('none');
  });

  it('is signed-in for an allowlisted user', () => {
    renderProbe();
    act(() => authCallback!({ email: 'teacher@example.com', uid: 'u1' }));
    expect(screen.getByTestId('status').textContent).toBe('signedIn');
    expect(screen.getByTestId('email').textContent).toBe('teacher@example.com');
  });

  it('signs out and reports signedOut for a non-allowlisted user', () => {
    renderProbe();
    act(() => authCallback!({ email: 'stranger@example.com', uid: 'u2' }));
    expect(signOut).toHaveBeenCalledWith({ kind: 'auth' });
    expect(screen.getByTestId('status').textContent).toBe('signedOut');
    expect(screen.getByTestId('email').textContent).toBe('none');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/auth/useAuth.test.tsx`
  - Expected: FAIL — `Failed to resolve import "./useAuth"` because `src/auth/useAuth.tsx` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/auth/useAuth.tsx`:

```tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '../firebase/config';
import { parseAllowlist, isEmailAllowed } from './allowlist';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthState {
  status: AuthStatus;
  user: User | null;
}

const AuthContext = createContext<AuthState>({
  status: 'loading',
  user: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
  });

  useEffect(() => {
    const allowlist = parseAllowlist(import.meta.env.VITE_TEACHER_ALLOWLIST);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setState({ status: 'signedOut', user: null });
        return;
      }
      // Enforce the allowlist client-side; Firestore rules are the real gate.
      if (isEmailAllowed(user.email, allowlist)) {
        setState({ status: 'signedIn', user });
      } else {
        // Not the teacher: drop the session and treat as signed out.
        void signOut(auth);
        setState({ status: 'signedOut', user: null });
      }
    });

    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/auth/useAuth.test.tsx`
  - Expected: PASS — 4 tests pass; loading → signedOut/signedIn transitions and non-allowlisted auto-sign-out all verified.

- [ ] **Step 5: Commit**
  - Run: `git add src/auth/useAuth.tsx src/auth/useAuth.test.tsx && git commit -m "Add useAuth hook with allowlist enforcement and auth state"`

---

### Task F6: Public landing page with a single "Sign in with Google" button

**Files:**
- Create: `src/pages/LandingPage.tsx`
- Test: `src/pages/LandingPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/pages/LandingPage.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the auth service so the button has something to call.
const signInWithGoogle = vi.fn(() => Promise.resolve({ email: 't@x.com' }));
vi.mock('../auth/authService', () => ({ signInWithGoogle }));

import LandingPage from './LandingPage';

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('describes the tool to an unauthenticated visitor', () => {
    render(<LandingPage />);
    expect(
      screen.getByRole('heading', { name: /student feedback emails/i }),
    ).toBeInTheDocument();
  });

  it('renders exactly one Sign in with Google button', () => {
    render(<LandingPage />);
    const buttons = screen.getAllByRole('button', {
      name: /sign in with google/i,
    });
    expect(buttons).toHaveLength(1);
  });

  it('calls signInWithGoogle when the button is clicked', async () => {
    render(<LandingPage />);
    await userEvent.click(
      screen.getByRole('button', { name: /sign in with google/i }),
    );
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('shows an error message if sign-in is rejected', async () => {
    signInWithGoogle.mockRejectedValueOnce(new Error('popup closed'));
    render(<LandingPage />);
    await userEvent.click(
      screen.getByRole('button', { name: /sign in with google/i }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/sign.?in failed/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/pages/LandingPage.test.tsx`
  - Expected: FAIL — `Failed to resolve import "./LandingPage"` because `src/pages/LandingPage.tsx` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/pages/LandingPage.tsx`:

```tsx
import { useState } from 'react';
import { signInWithGoogle } from '../auth/authService';

export default function LandingPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      // On success, useAuth's onAuthStateChanged drives the route change.
    } catch {
      setError('Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Student Feedback Emails</h1>
      <p>
        Turn a class roster and a tagged bank of comment templates into
        personalized, reviewable, batch-sent emails to your students.
      </p>
      <button type="button" onClick={handleSignIn} disabled={busy}>
        Sign in with Google
      </button>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/pages/LandingPage.test.tsx`
  - Expected: PASS — 4 tests pass; the page describes the tool, shows one sign-in button, calls the service, and surfaces a failure.

- [ ] **Step 5: Commit**
  - Run: `git add src/pages/LandingPage.tsx src/pages/LandingPage.test.tsx && git commit -m "Add public landing page with Sign in with Google button"`

---

### Task F7: Route guard (`RequireAuth`) bouncing signed-out users to the landing page

**Files:**
- Create: `src/auth/RequireAuth.tsx`
- Test: `src/auth/RequireAuth.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/auth/RequireAuth.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Control what useAuth returns per test.
// AuthState shape (from useAuth): { status: 'loading'|'signedIn'|'signedOut', user: User|null }
const useAuthMock = vi.fn();
vi.mock('./useAuth', () => ({ useAuth: () => useAuthMock() }));

import RequireAuth from './RequireAuth';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div>Landing</div>} />
        <Route
          path="/compose"
          element={
            <RequireAuth>
              <div>Protected Compose</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  it('renders a loading placeholder while auth resolves', () => {
    useAuthMock.mockReturnValue({ status: 'loading', user: null });
    renderAt('/compose');
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected Compose')).not.toBeInTheDocument();
  });

  it('redirects a signed-out user (deep link) to the landing page', () => {
    useAuthMock.mockReturnValue({ status: 'signedOut', user: null });
    renderAt('/compose');
    expect(screen.getByText('Landing')).toBeInTheDocument();
    expect(screen.queryByText('Protected Compose')).not.toBeInTheDocument();
  });

  it('renders the protected children for a signed-in user', () => {
    useAuthMock.mockReturnValue({
      status: 'signedIn',
      user: { email: 'teacher@example.com' },
    });
    renderAt('/compose');
    expect(screen.getByText('Protected Compose')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/auth/RequireAuth.test.tsx`
  - Expected: FAIL — `Failed to resolve import "./RequireAuth"` because `src/auth/RequireAuth.tsx` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `src/auth/RequireAuth.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

/**
 * Wrap any protected route. While auth is resolving, show a placeholder.
 * A signed-out visitor (including deep links) is redirected to the landing
 * page at "/". A signed-in teacher sees the protected children.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return <p>Loading…</p>;
  }

  if (status === 'signedOut') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/auth/RequireAuth.test.tsx`
  - Expected: PASS — 3 tests pass; loading placeholder, redirect-to-landing on signed-out, and pass-through on signed-in.

- [ ] **Step 5: Commit**
  - Run: `git add src/auth/RequireAuth.tsx src/auth/RequireAuth.test.tsx && git commit -m "Add RequireAuth route guard redirecting signed-out users to landing"`

---

### Task F8: Wire the router into `App` (landing + guarded home), update smoke test

**Files:**
- Create: `src/pages/HomePage.tsx`
- Modify: `src/App.tsx` (replace whole file — currently renders only an `<h1>Student Feedback Emails</h1>`)
- Modify: `src/main.tsx` (wrap `<App />` in `<AuthProvider>`; currently renders `<App />` bare inside `<StrictMode>`)
- Modify: `src/App.test.tsx` (replace whole file — currently a bare `render(<App />)` smoke test)
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/App.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// AuthState shape (from useAuth): { status: 'loading'|'signedIn'|'signedOut', user: User|null }
const useAuthMock = vi.fn();
vi.mock('./auth/useAuth', () => ({ useAuth: () => useAuthMock() }));

// Landing button calls into authService; stub it so no real Firebase is touched.
vi.mock('./auth/authService', () => ({
  signInWithGoogle: vi.fn(() => Promise.resolve({ email: 't@x.com' })),
  signOutTeacher: vi.fn(() => Promise.resolve()),
}));

import { AppRoutes } from './App';

function renderAt(path: string, auth: { status: string; user: unknown }) {
  useAuthMock.mockReturnValue(auth);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('AppRoutes', () => {
  it('shows the landing page at "/" when signed out', () => {
    renderAt('/', { status: 'signedOut', user: null });
    expect(
      screen.getByRole('button', { name: /sign in with google/i }),
    ).toBeInTheDocument();
  });

  it('bounces a signed-out deep link to "/home" back to the landing page', () => {
    renderAt('/home', { status: 'signedOut', user: null });
    expect(
      screen.getByRole('button', { name: /sign in with google/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument();
  });

  it('shows the protected home page for a signed-in teacher', () => {
    renderAt('/home', {
      status: 'signedIn',
      user: { email: 'teacher@example.com' },
    });
    expect(screen.getByText(/signed in as teacher@example.com/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/App.test.tsx`
  - Expected: FAIL — `App` has no named export `AppRoutes` (and no `HomePage` exists yet), so the import/render fails.

- [ ] **Step 3: Write minimal implementation**

Create `src/pages/HomePage.tsx`:

```tsx
import { useAuth } from '../auth/useAuth';
import { signOutTeacher } from '../auth/authService';

export default function HomePage() {
  const { user } = useAuth();
  return (
    <main>
      <h1>Student Feedback Emails</h1>
      <p>Signed in as {user?.email}</p>
      <button type="button" onClick={() => void signOutTeacher()}>
        Sign out
      </button>
    </main>
  );
}
```

Replace `src/App.tsx` entirely:

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import RequireAuth from './auth/RequireAuth';

/** Route table, exported separately so tests can wrap it in a MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/home"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      {/* Unknown deep links fall through to the landing page. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
```

Replace `src/main.tsx` entirely (wrap in router + auth provider):

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/useAuth';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/App.test.tsx`
  - Expected: PASS — 3 tests pass; landing at `/`, guarded `/home` bounces signed-out to landing, and renders for a signed-in teacher.

- [ ] **Step 5: Commit**
  - Run: `git add src/App.tsx src/App.test.tsx src/main.tsx src/pages/HomePage.tsx && git commit -m "Wire router with public landing and auth-guarded home route"`

---

### Task F9: Firestore security rules + rules-unit-testing proving a stranger can't read the owner's data

**Files:**
- Create: `firestore.rules`
- Create: `firebase.json`
- Create: `src/firebase/rules.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/firebase/rules.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'feedback-rules-test';
const OWNER_UID = 'owner-uid';
const STRANGER_UID = 'stranger-uid';

let testEnv: RulesTestEnvironment;

describe('Firestore security rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    // Seed a student owned by OWNER_UID, bypassing rules.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `teachers/${OWNER_UID}/classes/c1/students/s1`), {
        name: 'Carlos',
        email: 'carlos@example.com',
      });
    });
  });

  it('lets the owner read their own student', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      getDoc(doc(ownerDb, `teachers/${OWNER_UID}/classes/c1/students/s1`)),
    );
  });

  it('lets the owner write under their own tree', async () => {
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(ownerDb, `teachers/${OWNER_UID}/bankEntries/b1`), {
        templateText: 'Great work, {name}!',
      }),
    );
  });

  it('FORBIDS another signed-in account from reading the owner data', async () => {
    const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
    await assertFails(
      getDoc(doc(strangerDb, `teachers/${OWNER_UID}/classes/c1/students/s1`)),
    );
  });

  it('FORBIDS another account from writing into the owner tree', async () => {
    const strangerDb = testEnv.authenticatedContext(STRANGER_UID).firestore();
    await assertFails(
      setDoc(doc(strangerDb, `teachers/${OWNER_UID}/classes/c1/students/s2`), {
        name: 'Injected',
      }),
    );
  });

  it('FORBIDS an unauthenticated client from reading owner data', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      getDoc(doc(anonDb, `teachers/${OWNER_UID}/classes/c1/students/s1`)),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  - Run (emulator must be running — start it in a second terminal with `npx firebase emulators:start --only firestore`, then): `npx vitest run src/firebase/rules.test.ts`
  - Expected: FAIL — `firestore.rules` does not exist yet, so `readFileSync('firestore.rules', …)` throws `ENOENT` in `beforeAll`.

- [ ] **Step 3: Write minimal implementation**

Create `firestore.rules`:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Every document lives under a single teacher's tree keyed by their uid.
    // Only that signed-in owner may read or write anything beneath it.
    match /teachers/{ownerUid}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == ownerUid;
    }

    // Anything outside a teacher tree is denied by default (no catch-all rule).
  }
}
```

Create `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "emulators": {
    "firestore": {
      "host": "127.0.0.1",
      "port": 8080
    },
    "ui": {
      "enabled": false
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**
  - Run (with the Firestore emulator running, e.g. `npx firebase emulators:exec --only firestore "npx vitest run src/firebase/rules.test.ts"`):
  - Expected: PASS — 5 tests pass: the owner reads/writes their own data; a different authenticated account and an anonymous client are both denied reads and writes into the owner tree.

- [ ] **Step 5: Commit**
  - Run: `git add firestore.rules firebase.json src/firebase/rules.test.ts && git commit -m "Add Firestore owner-only security rules with rules-unit-testing proof"`

## Step R — Roster

### Task R1: `createClass` data fn

Writes `teachers/{uid}/classes/{classId}` with `{ name, period, semester, unit }` and
returns the new `classId`.

**Step 1 — failing test.** Create `src/data/createClass.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createClass } from './createClass';
import type { ClassMeta } from '../types';

describe('createClass', () => {
  it('writes to teachers/{uid}/classes and returns the new classId', async () => {
    const uid = 'teacher-1';
    // Fake the Firestore primitives the fn depends on.
    const collectionRef = { __path: '' } as const;
    const collection = vi.fn((_db, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async (_ref, _data) => ({ id: 'class-xyz' }));
    const db = { __fake: true };

    const input: Omit<ClassMeta, 'id'> = {
      name: 'Period 3 Biology',
      period: '3',
      semester: 'Spring',
      unit: 'Genetics',
    };

    const classId = await createClass(db as any, input, { collection, addDoc } as any);

    expect(classId).toBe('class-xyz');
    expect(collection).toHaveBeenCalledWith(db, `teachers/${uid}/classes`);
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(addDoc.mock.calls[0][1]).toEqual({
      name: 'Period 3 Biology',
      period: '3',
      semester: 'Spring',
      unit: 'Genetics',
    });
    // silence unused
    void collectionRef;
  });
});
```

Note: the test passes `uid` via the path assertion; align the signature in Step 3 so the
fn receives `uid`. Corrected test header (use this exact version):

```ts
import { describe, it, expect, vi } from 'vitest';
import { createClass } from './createClass';
import type { ClassMeta } from '../types';

describe('createClass', () => {
  it('writes to teachers/{uid}/classes and returns the new classId', async () => {
    const uid = 'teacher-1';
    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async () => ({ id: 'class-xyz' }));
    const db = { __fake: true };

    const input: Omit<ClassMeta, 'id'> = {
      name: 'Period 3 Biology',
      period: '3',
      semester: 'Spring',
      unit: 'Genetics',
    };

    const classId = await createClass(db as any, uid, input, { collection, addDoc } as any);

    expect(classId).toBe('class-xyz');
    expect(collection).toHaveBeenCalledWith(db, `teachers/${uid}/classes`);
    expect(addDoc.mock.calls[0][1]).toEqual({
      name: 'Period 3 Biology',
      period: '3',
      semester: 'Spring',
      unit: 'Genetics',
    });
  });
});
```

**Step 2 — run, expect FAIL:**

```
npx vitest run src/data/createClass.test.ts
```

Expected: fails to resolve `./createClass` (module does not exist yet).

**Step 3 — minimal implementation.** Create `src/data/createClass.ts`:

```ts
import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  type Firestore,
} from 'firebase/firestore';
import type { ClassMeta } from '../types';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface FirestoreWriteDeps {
  collection: typeof fbCollection;
  addDoc: typeof fbAddDoc;
}

const defaultDeps: FirestoreWriteDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
};

/**
 * Create a class under the signed-in teacher and return its new id.
 * Writes teachers/{uid}/classes/{classId} per the canonical Firestore paths.
 */
export async function createClass(
  db: Firestore,
  uid: string,
  meta: Omit<ClassMeta, 'id'>,
  deps: FirestoreWriteDeps = defaultDeps,
): Promise<string> {
  const { collection, addDoc } = deps;
  const ref = collection(db, `teachers/${uid}/classes`);
  const docRef = await addDoc(ref, {
    name: meta.name,
    period: meta.period,
    semester: meta.semester,
    unit: meta.unit,
  });
  return docRef.id;
}
```

**Step 4 — run, expect PASS:**

```
npx vitest run src/data/createClass.test.ts
```

Expected: 1 passed.

**Step 5 — commit:**

```
git add src/data/createClass.ts src/data/createClass.test.ts
git commit -m "feat(roster): add createClass data fn writing teachers/{uid}/classes"
```

### Task R2: `listClasses` data fn

Reads `teachers/{uid}/classes` and returns `ClassMeta[]` (id from the doc, fields from data).

**Step 1 — failing test.** Create `src/data/listClasses.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { listClasses } from './listClasses';
import type { ClassMeta } from '../types';

describe('listClasses', () => {
  it('reads teachers/{uid}/classes and maps docs to ClassMeta[]', async () => {
    const uid = 'teacher-1';
    const db = { __fake: true };

    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const snapshot = {
      docs: [
        { id: 'class-a', data: () => ({ name: 'Bio', period: '1', semester: 'Fall', unit: 'Cells' }) },
        { id: 'class-b', data: () => ({ name: 'Chem', period: '2' }) },
      ],
    };
    const getDocs = vi.fn(async () => snapshot);

    const result = await listClasses(db as any, uid, { collection, getDocs } as any);

    expect(collection).toHaveBeenCalledWith(db, `teachers/${uid}/classes`);
    const expected: ClassMeta[] = [
      { id: 'class-a', name: 'Bio', period: '1', semester: 'Fall', unit: 'Cells' },
      { id: 'class-b', name: 'Chem', period: '2' },
    ];
    expect(result).toEqual(expected);
  });
});
```

**Step 2 — run, expect FAIL:**

```
npx vitest run src/data/listClasses.test.ts
```

Expected: fails to resolve `./listClasses`.

**Step 3 — minimal implementation.** Create `src/data/listClasses.ts`:

```ts
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
```

**Step 4 — run, expect PASS:**

```
npx vitest run src/data/listClasses.test.ts
```

Expected: 1 passed.

**Step 5 — commit:**

```
git add src/data/listClasses.ts src/data/listClasses.test.ts
git commit -m "feat(roster): add listClasses data fn reading teachers/{uid}/classes"
```

### Task R3: `ClassesScreen` component

Lists classes and renders a "New class" form. Smoke test: renders class names and calls
`onCreate` with the form values.

**Step 1 — failing test.** Create `src/components/ClassesScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClassesScreen } from './ClassesScreen';
import type { ClassMeta } from '../types';

describe('ClassesScreen', () => {
  const classes: ClassMeta[] = [
    { id: 'class-a', name: 'Period 3 Biology', period: '3' },
    { id: 'class-b', name: 'Period 4 Chemistry', period: '4' },
  ];

  it('renders the class names', () => {
    render(<ClassesScreen classes={classes} onCreate={vi.fn()} />);
    expect(screen.getByText('Period 3 Biology')).toBeInTheDocument();
    expect(screen.getByText('Period 4 Chemistry')).toBeInTheDocument();
  });

  it('calls onCreate with the new-class form values', () => {
    const onCreate = vi.fn();
    render(<ClassesScreen classes={classes} onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('Class name'), {
      target: { value: 'Period 5 Physics' },
    });
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Semester'), { target: { value: 'Spring' } });
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'Motion' } });
    fireEvent.click(screen.getByRole('button', { name: 'New class' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Period 5 Physics',
      period: '5',
      semester: 'Spring',
      unit: 'Motion',
    });
  });
});
```

**Step 2 — run, expect FAIL:**

```
npx vitest run src/components/ClassesScreen.test.tsx
```

Expected: fails to resolve `./ClassesScreen`.

**Step 3 — minimal implementation.** Create `src/components/ClassesScreen.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import type { ClassMeta } from '../types';

export interface ClassesScreenProps {
  classes: ClassMeta[];
  onCreate: (meta: Omit<ClassMeta, 'id'>) => void;
}

export function ClassesScreen({ classes, onCreate }: ClassesScreenProps) {
  const [name, setName] = useState('');
  const [period, setPeriod] = useState('');
  const [semester, setSemester] = useState('');
  const [unit, setUnit] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() === '') return;
    onCreate({
      name: name.trim(),
      period: period.trim() || undefined,
      semester: semester.trim() || undefined,
      unit: unit.trim() || undefined,
    });
    setName('');
    setPeriod('');
    setSemester('');
    setUnit('');
  }

  return (
    <section>
      <h1>Classes</h1>
      <ul>
        {classes.map((c) => (
          <li key={c.id}>{c.name}</li>
        ))}
      </ul>

      <form onSubmit={handleSubmit}>
        <label htmlFor="class-name">Class name</label>
        <input id="class-name" value={name} onChange={(e) => setName(e.target.value)} />

        <label htmlFor="class-period">Period</label>
        <input id="class-period" value={period} onChange={(e) => setPeriod(e.target.value)} />

        <label htmlFor="class-semester">Semester</label>
        <input
          id="class-semester"
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
        />

        <label htmlFor="class-unit">Unit</label>
        <input id="class-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />

        <button type="submit">New class</button>
      </form>
    </section>
  );
}
```

The `<label htmlFor>` / matching `id` pairs are what make `getByLabelText('Class name')`
etc. resolve.

**Step 4 — run, expect PASS:**

```
npx vitest run src/components/ClassesScreen.test.tsx
```

Expected: 2 passed.

**Step 5 — commit:**

```
git add src/components/ClassesScreen.tsx src/components/ClassesScreen.test.tsx
git commit -m "feat(roster): add ClassesScreen list + New class form"
```

### Task R4: CORRECTED `saveStudents` data fn (fixes the top-level path)

**The fix:** the old version wrote students to a top-level `students` collection (or
`teachers/{uid}/students`), which the security rules and `listStudents`/compose roster do
not read. Students MUST live under their class:
`teachers/{uid}/classes/{classId}/students/{studentId}`. This consumes the `classId`
produced by `createClass` (Task 2A) and selected on `ClassesScreen` (Task 2C).

**Step 1 — failing test (asserts the corrected nested path).** Replace the body of
`src/data/saveStudents.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { saveStudents } from './saveStudents';
import type { Student } from '../types';

describe('saveStudents', () => {
  it('writes each student under teachers/{uid}/classes/{classId}/students', async () => {
    const uid = 'teacher-1';
    const classId = 'class-a';
    const db = { __fake: true };

    const collection = vi.fn((_db: unknown, path: string) => ({ __path: path }));
    const addDoc = vi.fn(async () => ({ id: 'generated' }));

    const students: Student[] = [
      { id: 's1', name: 'Ada Lovelace', email: 'ada@example.com', period: '3' },
      { id: 's2', name: 'Alan Turing', email: 'alan@example.com', period: '3' },
    ];

    const count = await saveStudents(
      db as any,
      uid,
      classId,
      students,
      { collection, addDoc } as any,
    );

    expect(count).toBe(2);
    // Corrected nested path — NOT a top-level collection.
    expect(collection).toHaveBeenCalledWith(
      db,
      `teachers/${uid}/classes/${classId}/students`,
    );
    expect(addDoc).toHaveBeenCalledTimes(2);
    expect(addDoc.mock.calls[0][1]).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      period: '3',
    });
    expect(addDoc.mock.calls[1][1]).toEqual({
      name: 'Alan Turing',
      email: 'alan@example.com',
      period: '3',
    });
  });
});
```

**Step 2 — run, expect FAIL:**

```
npx vitest run src/data/saveStudents.test.ts
```

Expected: FAIL — the old implementation calls `collection(db, 'students')` (or
`teachers/${uid}/students`), so the path assertion fails (`expected … to be called with
teachers/teacher-1/classes/class-a/students`). If the file doesn't exist yet, it fails to
resolve `./saveStudents` instead — either way, red.

**Step 3 — full corrected implementation.** Replace `src/data/saveStudents.ts` entirely:

```ts
import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Student } from '../types';

/** Injectable Firestore primitives — defaults to the real SDK, overridable in tests. */
export interface FirestoreWriteDeps {
  collection: typeof fbCollection;
  addDoc: typeof fbAddDoc;
}

const defaultDeps: FirestoreWriteDeps = {
  collection: fbCollection,
  addDoc: fbAddDoc,
};

/**
 * Persist imported students under their class.
 *
 * CORRECTED PATH: teachers/{uid}/classes/{classId}/students/{studentId}
 * (the old top-level `students` collection is gone — that path is denied by the
 * security rules and never read by the roster/compose screens).
 *
 * Returns the number of students written.
 */
export async function saveStudents(
  db: Firestore,
  uid: string,
  classId: string,
  students: Student[],
  deps: FirestoreWriteDeps = defaultDeps,
): Promise<number> {
  const { collection, addDoc } = deps;
  const ref = collection(db, `teachers/${uid}/classes/${classId}/students`);

  for (const s of students) {
    await addDoc(ref, {
      name: s.name,
      email: s.email,
      period: s.period,
    });
  }

  return students.length;
}
```

**Step 4 — run, expect PASS:**

```
npx vitest run src/data/saveStudents.test.ts
```

Expected: 1 passed. The write path now matches the security rules and the `classId`
flowing in from `createClass` / `ClassesScreen`.

**Step 5 — commit:**

```
git add src/data/saveStudents.ts src/data/saveStudents.test.ts
git commit -m "fix(roster): write students to teachers/{uid}/classes/{classId}/students"
```
```

Relevant files referenced by these tasks (all under the repo root `/Users/shiebenaderet/Documents/GitHub/feedback`):
- Spec read: `/Users/shiebenaderet/Documents/GitHub/feedback/docs/superpowers/specs/2026-06-16-personalized-student-feedback-emails-design.md`
- Tasks produce/modify: `src/data/createClass.ts`(+`.test.ts`), `src/data/listClasses.ts`(+`.test.ts`), `src/components/ClassesScreen.tsx`(+`.test.tsx`), `src/data/saveStudents.ts`(+`.test.ts`) — importing canonical types from `src/types.ts` and `db` from `src/firebase/config.ts`.

Note: the repo is currently greenfield (no `package.json`/`src/` yet), so these are plan-time TDD task blocks; they assume the Foundation step's Vite + React + vitest + `@testing-library/react` setup and the canonical `src/types.ts` / `src/firebase/config.ts` already exist when executed.

### Task R5: Roster types and `RawRow` parsing contract

**Files:**
- Create: `src/roster/types.ts`
- Test: `src/roster/types.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// src/roster/types.test.ts
import { describe, it, expect } from 'vitest';
import { EMPTY_PARSE_RESULT, type ParsedStudent, type ParseResult } from './types';

describe('roster types', () => {
  it('EMPTY_PARSE_RESULT is a usable zero-value ParseResult', () => {
    const r: ParseResult = EMPTY_PARSE_RESULT;
    expect(r.students).toEqual([]);
    expect(r.skipped).toEqual([]);
    expect(r.duplicates).toEqual([]);
    expect(r.columnMapping).toEqual({ name: null, email: null, period: null });
  });

  it('a ParsedStudent carries normalized fields', () => {
    const s: ParsedStudent = { name: 'Ada Lovelace', email: 'ada@x.edu', period: '3', sourceRow: 2 };
    expect(s.name).toBe('Ada Lovelace');
    expect(s.sourceRow).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/roster/types.test.ts`
Expected: FAIL because `src/roster/types.ts` does not exist yet (module resolution error / `EMPTY_PARSE_RESULT` undefined).

- [ ] **Step 3: Write minimal implementation**
```ts
// src/roster/types.ts

/** A cleaned, importable student record produced from one CSV data row. */
export interface ParsedStudent {
  name: string;
  email: string;
  /** Optional class period; empty string when the column is absent/blank. */
  period: string;
  /** 1-based index of the source data row (header = row 1), for "show the bad row" UX. */
  sourceRow: number;
}

/** A row that was NOT imported, with a human-readable reason. */
export interface SkippedRow {
  sourceRow: number;
  reason: string;
  /** Raw cell values as they appeared, for display in the preview. */
  raw: Record<string, string>;
}

/** A pair of rows whose emails collide (case-insensitive). */
export interface DuplicateGroup {
  email: string;
  sourceRows: number[];
}

/** Which CSV header (verbatim) mapped to each logical field; null = not found. */
export interface ColumnMapping {
  name: string | null;
  email: string | null;
  period: string | null;
}

/** Full result of parsing a roster CSV. */
export interface ParseResult {
  students: ParsedStudent[];
  skipped: SkippedRow[];
  duplicates: DuplicateGroup[];
  columnMapping: ColumnMapping;
}

export const EMPTY_PARSE_RESULT: ParseResult = {
  students: [],
  skipped: [],
  duplicates: [],
  columnMapping: { name: null, email: null, period: null },
};
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/roster/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/roster/types.ts src/roster/types.test.ts && git commit -m "Add roster parse result types"`

---

### Task R6: Header mapping — `mapColumns`

**Files:**
- Create: `src/roster/mapColumns.ts`
- Test: `src/roster/mapColumns.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// src/roster/mapColumns.test.ts
import { describe, it, expect } from 'vitest';
import { mapColumns } from './mapColumns';

describe('mapColumns', () => {
  it('maps canonical headers case/space-insensitively', () => {
    expect(mapColumns(['Name', 'Email', 'Period'])).toEqual({
      name: 'Name', email: 'Email', period: 'Period',
    });
  });

  it('recognizes common synonyms and odd column order', () => {
    expect(mapColumns(['Student E-Mail', 'Class', 'Full Name'])).toEqual({
      name: 'Full Name', email: 'Student E-Mail', period: 'Class',
    });
  });

  it('returns null for fields whose column is absent', () => {
    expect(mapColumns(['Name', 'Email'])).toEqual({
      name: 'Name', email: 'Email', period: null,
    });
  });

  it('does not match an unrelated extra column', () => {
    const m = mapColumns(['Name', 'Email', 'GPA']);
    expect(m.period).toBeNull();
  });

  it('takes the first matching header when synonyms repeat', () => {
    expect(mapColumns(['email', 'Email Address']).email).toBe('email');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/roster/mapColumns.test.ts`
Expected: FAIL because `mapColumns` is not implemented yet (module not found).

- [ ] **Step 3: Write minimal implementation**
```ts
// src/roster/mapColumns.ts

// ColumnMapping shape (from src/roster/types.ts):
//   { name: string | null; email: string | null; period: string | null }
import type { ColumnMapping } from './types';

/** Synonyms per logical field. First header (in file order) matching any wins. */
const SYNONYMS: Record<keyof ColumnMapping, string[]> = {
  name: ['name', 'full name', 'student name', 'student'],
  email: ['email', 'e-mail', 'email address', 'student email', 'student e-mail'],
  period: ['period', 'class', 'class period', 'section', 'block'],
};

/** Normalize a header for comparison: lowercase, collapse whitespace, trim. */
function norm(h: string): string {
  return h.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Map verbatim CSV headers to logical fields. Returns the original header string
 * (so callers can index PapaParse row objects), or null when no column matches.
 */
export function mapColumns(headers: string[]): ColumnMapping {
  const result: ColumnMapping = { name: null, email: null, period: null };
  for (const field of Object.keys(SYNONYMS) as (keyof ColumnMapping)[]) {
    const wanted = SYNONYMS[field];
    const found = headers.find((h) => wanted.includes(norm(h)));
    result[field] = found ?? null;
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/roster/mapColumns.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/roster/mapColumns.ts src/roster/mapColumns.test.ts && git commit -m "Add header-to-field column mapping"`

---

### Task R7: Field normalization — `normalizeName` and `normalizeEmail`

**Files:**
- Create: `src/roster/normalize.ts`
- Test: `src/roster/normalize.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// src/roster/normalize.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeName, normalizeEmail } from './normalize';

describe('normalizeName', () => {
  it('flips "Last, First" into "First Last"', () => {
    expect(normalizeName('Lovelace, Ada')).toBe('Ada Lovelace');
  });

  it('handles "Last, First Middle"', () => {
    expect(normalizeName('Curie, Marie Sklodowska')).toBe('Marie Sklodowska Curie');
  });

  it('leaves an already "First Last" name untouched', () => {
    expect(normalizeName('Ada Lovelace')).toBe('Ada Lovelace');
  });

  it('collapses internal/edge whitespace', () => {
    expect(normalizeName('  Ada   Lovelace  ')).toBe('Ada Lovelace');
  });

  it('ignores a trailing comma with no second part', () => {
    expect(normalizeName('Lovelace,')).toBe('Lovelace');
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Ada@X.EDU ')).toBe('ada@x.edu');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeEmail('   ')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/roster/normalize.test.ts`
Expected: FAIL because `normalize.ts` does not exist (module not found).

- [ ] **Step 3: Write minimal implementation**
```ts
// src/roster/normalize.ts

/** Collapse runs of whitespace and trim ends. */
function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize a name into "First [Middle] Last" order.
 * If the value contains exactly one comma, treat it as "Last, First ..." and flip it.
 * Otherwise return the whitespace-collapsed value unchanged.
 */
export function normalizeName(raw: string): string {
  const value = collapse(raw);
  const commaParts = value.split(',');
  if (commaParts.length === 2) {
    const last = collapse(commaParts[0]);
    const rest = collapse(commaParts[1]);
    if (last && rest) return `${rest} ${last}`;
    return last || rest;
  }
  return value;
}

/** Lowercase + trim an email; returns '' for whitespace-only input. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/roster/normalize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/roster/normalize.ts src/roster/normalize.test.ts && git commit -m "Add name and email normalization helpers"`

---

### Task R8: Core parser — `parseRoster` with PapaParse (messy-data cases)

**Files:**
- Create: `src/roster/parseRoster.ts`
- Test: `src/roster/parseRoster.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// src/roster/parseRoster.test.ts
import { describe, it, expect } from 'vitest';
import { parseRoster } from './parseRoster';

describe('parseRoster', () => {
  it('parses a clean CSV and reports the column mapping', () => {
    const csv = 'Name,Email,Period\nAda Lovelace,ada@x.edu,3\nAlan Turing,alan@x.edu,3\n';
    const r = parseRoster(csv);
    expect(r.students).toEqual([
      { name: 'Ada Lovelace', email: 'ada@x.edu', period: '3', sourceRow: 2 },
      { name: 'Alan Turing', email: 'alan@x.edu', period: '3', sourceRow: 3 },
    ]);
    expect(r.columnMapping).toEqual({ name: 'Name', email: 'Email', period: 'Period' });
    expect(r.skipped).toEqual([]);
    expect(r.duplicates).toEqual([]);
  });

  it('skips rows with a blank email, not silently', () => {
    const csv = 'Name,Email\nAda Lovelace,ada@x.edu\nNo Email,   \n';
    const r = parseRoster(csv);
    expect(r.students.map((s) => s.email)).toEqual(['ada@x.edu']);
    expect(r.skipped).toEqual([
      { sourceRow: 3, reason: 'Missing email', raw: { Name: 'No Email', Email: '   ' } },
    ]);
  });

  it('skips rows with an invalid email format', () => {
    const csv = 'Name,Email\nBad Addr,not-an-email\n';
    const r = parseRoster(csv);
    expect(r.students).toEqual([]);
    expect(r.skipped[0].reason).toBe('Invalid email format');
  });

  it('normalizes "Last, First" names via quoted CSV fields', () => {
    const csv = 'Name,Email\n"Lovelace, Ada",ada@x.edu\n';
    const r = parseRoster(csv);
    expect(r.students[0].name).toBe('Ada Lovelace');
  });

  it('detects duplicate emails case-insensitively, keeping the first', () => {
    const csv = 'Name,Email\nAda,ada@x.edu\nAda Again,ADA@x.edu\n';
    const r = parseRoster(csv);
    expect(r.students.map((s) => s.email)).toEqual(['ada@x.edu']);
    expect(r.duplicates).toEqual([{ email: 'ada@x.edu', sourceRows: [2, 3] }]);
    expect(r.skipped).toContainEqual(
      expect.objectContaining({ sourceRow: 3, reason: 'Duplicate email' }),
    );
  });

  it('ignores extra/over columns and fills period with "" when absent', () => {
    const csv = 'Full Name,GPA,Student E-Mail\nAda Lovelace,4.0,ada@x.edu\n';
    const r = parseRoster(csv);
    expect(r.students[0]).toEqual({ name: 'Ada Lovelace', email: 'ada@x.edu', period: '', sourceRow: 2 });
    expect(r.columnMapping.period).toBeNull();
  });

  it('skips a row missing the name column value', () => {
    const csv = 'Name,Email\n,ada@x.edu\n';
    const r = parseRoster(csv);
    expect(r.students).toEqual([]);
    expect(r.skipped[0].reason).toBe('Missing name');
  });

  it('errors out cleanly when no email column can be found', () => {
    const csv = 'Name,Phone\nAda,555\n';
    const r = parseRoster(csv);
    expect(r.students).toEqual([]);
    expect(r.skipped[0].reason).toBe('No email column found in file');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/roster/parseRoster.test.ts`
Expected: FAIL because `parseRoster` is not implemented (module not found).

- [ ] **Step 3: Write minimal implementation**
```ts
// src/roster/parseRoster.ts
import Papa from 'papaparse';
import { mapColumns } from './mapColumns';
import { normalizeName, normalizeEmail } from './normalize';
// ParseResult/ParsedStudent/SkippedRow/DuplicateGroup shapes live in src/roster/types.ts:
//   ParsedStudent  = { name; email; period; sourceRow }
//   SkippedRow     = { sourceRow; reason; raw: Record<string,string> }
//   DuplicateGroup = { email; sourceRows: number[] }
//   ParseResult    = { students; skipped; duplicates; columnMapping }
import type { ParseResult, ParsedStudent, SkippedRow, DuplicateGroup } from './types';
import { EMPTY_PARSE_RESULT } from './types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse a roster CSV string into students + a full audit of what was skipped.
 * Pure: no I/O. PapaParse runs with `header: true`; row objects are keyed by header.
 */
export function parseRoster(csv: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const headers = parsed.meta.fields ?? [];
  const columnMapping = mapColumns(headers);

  // No email column at all → nothing is importable; report one explanatory skip.
  if (!columnMapping.email) {
    return {
      ...EMPTY_PARSE_RESULT,
      columnMapping,
      skipped: [{ sourceRow: 1, reason: 'No email column found in file', raw: {} }],
    };
  }

  const students: ParsedStudent[] = [];
  const skipped: SkippedRow[] = [];
  const dupRowsByEmail = new Map<string, number[]>();
  const seenEmails = new Set<string>();

  parsed.data.forEach((row, i) => {
    const sourceRow = i + 2; // header is row 1; first data row is row 2.
    const rawName = columnMapping.name ? (row[columnMapping.name] ?? '') : '';
    const rawEmail = row[columnMapping.email!] ?? '';
    const rawPeriod = columnMapping.period ? (row[columnMapping.period] ?? '') : '';

    const name = normalizeName(rawName);
    const email = normalizeEmail(rawEmail);

    if (!email) {
      skipped.push({ sourceRow, reason: 'Missing email', raw: row });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      skipped.push({ sourceRow, reason: 'Invalid email format', raw: row });
      return;
    }
    if (!name) {
      skipped.push({ sourceRow, reason: 'Missing name', raw: row });
      return;
    }

    if (seenEmails.has(email)) {
      const rows = dupRowsByEmail.get(email);
      if (rows) rows.push(sourceRow);
      skipped.push({ sourceRow, reason: 'Duplicate email', raw: row });
      return;
    }

    seenEmails.add(email);
    dupRowsByEmail.set(email, [sourceRow]);
    students.push({ name, email, period: rawPeriod.trim(), sourceRow });
  });

  const duplicates: DuplicateGroup[] = [];
  for (const [email, sourceRows] of dupRowsByEmail) {
    if (sourceRows.length > 1) duplicates.push({ email, sourceRows });
  }

  return { students, skipped, duplicates, columnMapping };
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/roster/parseRoster.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/roster/parseRoster.ts src/roster/parseRoster.test.ts && git commit -m "Add parseRoster with messy-data handling"`

---

### Task R9: Import preview component — `ImportPreview`

**Files:**
- Create: `src/roster/ImportPreview.tsx`
- Test: `src/roster/ImportPreview.test.tsx`

- [ ] **Step 1: Write the failing test**
```tsx
// src/roster/ImportPreview.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportPreview } from './ImportPreview';

// ParseResult shape (src/roster/types.ts):
//   { students:[{name,email,period,sourceRow}], skipped:[{sourceRow,reason,raw}],
//     duplicates:[{email,sourceRows}], columnMapping:{name,email,period} }
const result = {
  students: [
    { name: 'Ada Lovelace', email: 'ada@x.edu', period: '3', sourceRow: 2 },
    { name: 'Alan Turing', email: 'alan@x.edu', period: '3', sourceRow: 3 },
  ],
  skipped: [{ sourceRow: 4, reason: 'Missing email', raw: { Name: 'No Email', Email: '' } }],
  duplicates: [],
  columnMapping: { name: 'Name', email: 'Email', period: 'Period' },
};

describe('ImportPreview', () => {
  it('summarizes found and skipped counts', () => {
    render(<ImportPreview result={result} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/found 2 students/i)).toBeInTheDocument();
    expect(screen.getByText(/1 skipped/i)).toBeInTheDocument();
  });

  it('shows the column mapping and each skipped row with its reason', () => {
    render(<ImportPreview result={result} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/name → Name/i)).toBeInTheDocument();
    expect(screen.getByText(/email → Email/i)).toBeInTheDocument();
    expect(screen.getByText(/Row 4/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing email/i)).toBeInTheDocument();
  });

  it('confirm is enabled and fires onConfirm when there are students', () => {
    const onConfirm = vi.fn();
    render(<ImportPreview result={result} onConfirm={onConfirm} onCancel={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /import 2 students/i });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables confirm when there are zero importable students', () => {
    const empty = { ...result, students: [] };
    render(<ImportPreview result={empty} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /import 0 students/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/roster/ImportPreview.test.tsx`
Expected: FAIL because `ImportPreview.tsx` does not exist (module not found).

- [ ] **Step 3: Write minimal implementation**
```tsx
// src/roster/ImportPreview.tsx
import type { ParseResult } from './types';

interface ImportPreviewProps {
  result: ParseResult;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Pre-commit review of a parsed roster: found/skipped counts, the column mapping,
 * and every skipped row with its reason (never silently dropped). Confirm writes;
 * cancel discards. Confirm is disabled when there is nothing importable.
 */
export function ImportPreview({ result, onConfirm, onCancel }: ImportPreviewProps) {
  const { students, skipped, duplicates, columnMapping } = result;
  const canImport = students.length > 0;

  return (
    <div className="import-preview">
      <p>
        Found {students.length} students, {skipped.length} skipped
        {duplicates.length > 0 ? `, ${duplicates.length} duplicate email(s)` : ''}.
      </p>

      <h3>Column mapping</h3>
      <ul>
        <li>name → {columnMapping.name ?? '(not found)'}</li>
        <li>email → {columnMapping.email ?? '(not found)'}</li>
        <li>period → {columnMapping.period ?? '(not found)'}</li>
      </ul>

      {skipped.length > 0 && (
        <>
          <h3>Skipped rows</h3>
          <ul>
            {skipped.map((s) => (
              <li key={s.sourceRow}>
                Row {s.sourceRow}: {s.reason}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="import-preview-actions">
        <button type="button" onClick={onConfirm} disabled={!canImport}>
          Import {students.length} students
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/roster/ImportPreview.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/roster/ImportPreview.tsx src/roster/ImportPreview.test.tsx && git commit -m "Add import preview component"`

---

### Task R10: Sort helper — `sortStudentsByName`

**Files:**
- Create: `src/roster/sortStudents.ts`
- Test: `src/roster/sortStudents.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// src/roster/sortStudents.test.ts
import { describe, it, expect } from 'vitest';
import { sortStudentsByName } from './sortStudents';

// Minimal student shape this helper needs: { name: string }
describe('sortStudentsByName', () => {
  it('sorts ascending by name, case-insensitively', () => {
    const out = sortStudentsByName(
      [{ name: 'alan turing' }, { name: 'Ada Lovelace' }, { name: 'Brian K' }],
      'asc',
    );
    expect(out.map((s) => s.name)).toEqual(['Ada Lovelace', 'alan turing', 'Brian K']);
  });

  it('sorts descending when asked', () => {
    const out = sortStudentsByName(
      [{ name: 'Ada' }, { name: 'Zed' }, { name: 'Max' }],
      'desc',
    );
    expect(out.map((s) => s.name)).toEqual(['Zed', 'Max', 'Ada']);
  });

  it('does not mutate the input array', () => {
    const input = [{ name: 'B' }, { name: 'A' }];
    const out = sortStudentsByName(input, 'asc');
    expect(input.map((s) => s.name)).toEqual(['B', 'A']);
    expect(out.map((s) => s.name)).toEqual(['A', 'B']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/roster/sortStudents.test.ts`
Expected: FAIL because `sortStudents.ts` does not exist (module not found).

- [ ] **Step 3: Write minimal implementation**
```ts
// src/roster/sortStudents.ts

export type SortDir = 'asc' | 'desc';

/** Anything with a display name; works for ParsedStudent and Firestore-loaded students. */
interface HasName {
  name: string;
}

/**
 * Return a new array sorted by `name` using locale-aware, case-insensitive comparison.
 * Pure: the input array is not mutated.
 */
export function sortStudentsByName<T extends HasName>(students: T[], dir: SortDir = 'asc'): T[] {
  const factor = dir === 'desc' ? -1 : 1;
  return [...students].sort(
    (a, b) => factor * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/roster/sortStudents.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/roster/sortStudents.ts src/roster/sortStudents.test.ts && git commit -m "Add name sort helper"`

---

### Task R11: Roster view — `RosterTable` (sortable by name)

**Files:**
- Create: `src/roster/RosterTable.tsx`
- Test: `src/roster/RosterTable.test.tsx`

- [ ] **Step 1: Write the failing test**
```tsx
// src/roster/RosterTable.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { RosterTable } from './RosterTable';

// Student shape rendered: { id, name, email, period }
const students = [
  { id: 'a', name: 'Brian K', email: 'brian@x.edu', period: '3' },
  { id: 'b', name: 'Ada Lovelace', email: 'ada@x.edu', period: '3' },
  { id: 'c', name: 'alan turing', email: 'alan@x.edu', period: '2' },
];

function rowNames(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1) // skip header row
    .map((r) => within(r).getAllByRole('cell')[0].textContent);
}

describe('RosterTable', () => {
  it('renders rows sorted by name ascending by default', () => {
    render(<RosterTable students={students} />);
    expect(rowNames()).toEqual(['Ada Lovelace', 'alan turing', 'Brian K']);
  });

  it('toggles to descending when the Name header is clicked', () => {
    render(<RosterTable students={students} />);
    fireEvent.click(screen.getByRole('button', { name: /name/i }));
    expect(rowNames()).toEqual(['Brian K', 'alan turing', 'Ada Lovelace']);
  });

  it('shows an empty state when there are no students', () => {
    render(<RosterTable students={[]} />);
    expect(screen.getByText(/no students yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/roster/RosterTable.test.tsx`
Expected: FAIL because `RosterTable.tsx` does not exist (module not found).

- [ ] **Step 3: Write minimal implementation**
```tsx
// src/roster/RosterTable.tsx
import { useState } from 'react';
import { sortStudentsByName, type SortDir } from './sortStudents';

/** A persisted student loaded from Firestore (doc id + the stored fields). */
export interface RosterStudent {
  id: string;
  name: string;
  email: string;
  period: string;
}

interface RosterTableProps {
  students: RosterStudent[];
}

/** Roster view: a table of students, sortable by name (click the header to toggle). */
export function RosterTable({ students }: RosterTableProps) {
  const [dir, setDir] = useState<SortDir>('asc');

  if (students.length === 0) {
    return <p className="roster-empty">No students yet. Import a CSV to get started.</p>;
  }

  const sorted = sortStudentsByName(students, dir);
  const arrow = dir === 'asc' ? '▲' : '▼';

  return (
    <table className="roster-table">
      <thead>
        <tr>
          <th>
            <button type="button" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}>
              Name {arrow}
            </button>
          </th>
          <th>Email</th>
          <th>Period</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((s) => (
          <tr key={s.id}>
            <td>{s.name}</td>
            <td>{s.email}</td>
            <td>{s.period}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/roster/RosterTable.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/roster/RosterTable.tsx src/roster/RosterTable.test.tsx && git commit -m "Add sortable roster table view"`

## Step K — Bank

### Task K1: `extractSlots` — parse `{slot}` keys from template text and classify auto vs fill

**Files:**
- Create: `src/bank/extractSlots.ts`
- Test: `src/bank/extractSlots.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/bank/extractSlots.test.ts
import { describe, it, expect } from "vitest";
import { extractSlots } from "./extractSlots";

describe("extractSlots", () => {
  it("returns no slots for template text without placeholders", () => {
    expect(extractSlots("Great work this term.")).toEqual([]);
  });

  it("classifies name and semester as auto slots", () => {
    expect(extractSlots("Hi {name}, this {semester} was strong.")).toEqual([
      { key: "name", kind: "auto", hint: "" },
      { key: "semester", kind: "auto", hint: "" },
    ]);
  });

  it("classifies any other slot as fill", () => {
    expect(extractSlots("You improved at {skill}.")).toEqual([
      { key: "skill", kind: "fill", hint: "" },
    ]);
  });

  it("is case-insensitive for auto keys and normalizes the key to lowercase", () => {
    expect(extractSlots("Hi {Name}, the {SEMESTER}.")).toEqual([
      { key: "name", kind: "auto", hint: "" },
      { key: "semester", kind: "auto", hint: "" },
    ]);
  });

  it("trims whitespace inside braces", () => {
    expect(extractSlots("Hi { name }.")).toEqual([
      { key: "name", kind: "auto", hint: "" },
    ]);
  });

  it("dedupes a repeated slot, keeping first occurrence order", () => {
    expect(extractSlots("{name} did well. Keep it up, {name}!")).toEqual([
      { key: "name", kind: "auto", hint: "" },
    ]);
  });

  it("mixes auto and fill slots in source order", () => {
    expect(
      extractSlots("Hi {name}, you grew in {area} this {semester}.")
    ).toEqual([
      { key: "name", kind: "auto", hint: "" },
      { key: "area", kind: "fill", hint: "" },
      { key: "semester", kind: "auto", hint: "" },
    ]);
  });

  it("ignores empty braces", () => {
    expect(extractSlots("This {} is not a slot, but {x} is.")).toEqual([
      { key: "x", kind: "fill", hint: "" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/bank/extractSlots.test.ts`
  Expected: FAIL because `src/bank/extractSlots.ts` does not exist yet (module not found / `extractSlots` is not exported).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/bank/extractSlots.ts

// A slot parsed from template text. Mirrors the bankEntry slot shape:
// { key: string; kind: "auto" | "fill"; hint: string }
export interface Slot {
  key: string;
  kind: "auto" | "fill";
  hint: string;
}

// Auto-resolvable slot keys (everything else is a "you-fill" slot).
const AUTO_KEYS = new Set(["name", "semester"]);

/**
 * Extracts {slot} keys from template text in source order, de-duplicated,
 * and classifies each as "auto" (name/semester) or "fill" (everything else).
 * Keys are trimmed and lowercased; empty braces are ignored. hint starts blank.
 */
export function extractSlots(templateText: string): Slot[] {
  const pattern = /\{([^{}]*)\}/g;
  const seen = new Set<string>();
  const slots: Slot[] = [];

  for (const match of templateText.matchAll(pattern)) {
    const key = match[1].trim().toLowerCase();
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    slots.push({
      key,
      kind: AUTO_KEYS.has(key) ? "auto" : "fill",
      hint: "",
    });
  }

  return slots;
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/bank/extractSlots.test.ts`
  Expected: PASS (all 8 cases green).

- [ ] **Step 5: Commit**
  `git add src/bank/extractSlots.ts src/bank/extractSlots.test.ts && git commit -m "Add extractSlots: parse and classify template slot keys"`

---

### Task K2: `bankEntry` types and `makeBankEntryInput` factory

**Files:**
- Create: `src/bank/types.ts`
- Test: `src/bank/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/bank/types.test.ts
import { describe, it, expect } from "vitest";
import { EMPTY_TAGS, makeBankEntryInput } from "./types";

describe("makeBankEntryInput", () => {
  it("derives slots from the template text", () => {
    const input = makeBankEntryInput({
      templateText: "Hi {name}, you grew in {area}.",
      tags: EMPTY_TAGS,
    });
    expect(input.slots).toEqual([
      { key: "name", kind: "auto", hint: "" },
      { key: "area", kind: "fill", hint: "" },
    ]);
  });

  it("keeps the provided template text and tags", () => {
    const tags = { type: "success", area: "writing", objective: "", tone: "warm" };
    const input = makeBankEntryInput({
      templateText: "Nice work {name}.",
      tags,
    });
    expect(input.templateText).toBe("Nice work {name}.");
    expect(input.tags).toEqual(tags);
  });

  it("EMPTY_TAGS has all four tag keys blank", () => {
    expect(EMPTY_TAGS).toEqual({ type: "", area: "", objective: "", tone: "" });
  });

  it("produces an empty slots array when there are no placeholders", () => {
    const input = makeBankEntryInput({
      templateText: "Great term overall.",
      tags: EMPTY_TAGS,
    });
    expect(input.slots).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/bank/types.test.ts`
  Expected: FAIL because `src/bank/types.ts` does not exist (no `makeBankEntryInput` / `EMPTY_TAGS` export).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/bank/types.ts
import { extractSlots, type Slot } from "./extractSlots";

// Slot is re-exported so consumers import everything bank-shaped from one place.
// Slot = { key: string; kind: "auto" | "fill"; hint: string }
export type { Slot };

// Tags on a bank entry. unit/project are deferred (spec), so only these four.
export interface BankTags {
  type: string;
  area: string;
  objective: string;
  tone: string;
}

export const EMPTY_TAGS: BankTags = {
  type: "",
  area: "",
  objective: "",
  tone: "",
};

// The fields a teacher edits + the derived slots. No id/owner here — those are
// added at the Firestore layer.
export interface BankEntryInput {
  templateText: string;
  slots: Slot[];
  tags: BankTags;
}

// A persisted bank entry: input fields plus its Firestore document id.
export interface BankEntry extends BankEntryInput {
  id: string;
}

/**
 * Builds a BankEntryInput from raw editor fields, deriving slots from the
 * template text so slots never desync from the text.
 */
export function makeBankEntryInput(fields: {
  templateText: string;
  tags: BankTags;
}): BankEntryInput {
  return {
    templateText: fields.templateText,
    slots: extractSlots(fields.templateText),
    tags: fields.tags,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/bank/types.test.ts`
  Expected: PASS (all 4 cases green).

- [ ] **Step 5: Commit**
  `git add src/bank/types.ts src/bank/types.test.ts && git commit -m "Add bank entry types and makeBankEntryInput factory"`

---

### Task K3: `filterBankEntries` — tag-based filtering + text search (pure)

**Files:**
- Create: `src/bank/filterBankEntries.ts`
- Test: `src/bank/filterBankEntries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/bank/filterBankEntries.test.ts
import { describe, it, expect } from "vitest";
import { filterBankEntries } from "./filterBankEntries";

// BankEntry shape (from src/bank/types.ts):
// { id: string; templateText: string;
//   slots: { key: string; kind: "auto"|"fill"; hint: string }[];
//   tags: { type: string; area: string; objective: string; tone: string } }
const entries = [
  {
    id: "a",
    templateText: "Hi {name}, your writing improved a lot.",
    slots: [{ key: "name", kind: "auto" as const, hint: "" }],
    tags: { type: "success", area: "writing", objective: "clarity", tone: "warm" },
  },
  {
    id: "b",
    templateText: "Let's work on turning in homework on time.",
    slots: [],
    tags: { type: "growth", area: "responsibility", objective: "deadlines", tone: "firm" },
  },
  {
    id: "c",
    templateText: "Your lab WRITING was excellent this semester.",
    slots: [],
    tags: { type: "success", area: "science", objective: "lab-work", tone: "warm" },
  },
];

describe("filterBankEntries", () => {
  it("returns all entries when no filters are set", () => {
    const result = filterBankEntries(entries, { tags: {}, search: "" });
    expect(result.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("filters by a single tag (exact match)", () => {
    const result = filterBankEntries(entries, {
      tags: { type: "success" },
      search: "",
    });
    expect(result.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("ANDs multiple tag filters together", () => {
    const result = filterBankEntries(entries, {
      tags: { type: "success", tone: "warm", area: "science" },
      search: "",
    });
    expect(result.map((e) => e.id)).toEqual(["c"]);
  });

  it("ignores blank tag filter values", () => {
    const result = filterBankEntries(entries, {
      tags: { type: "success", area: "" },
      search: "",
    });
    expect(result.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("searches templateText case-insensitively", () => {
    const result = filterBankEntries(entries, { tags: {}, search: "writing" });
    expect(result.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("trims the search term and ignores surrounding whitespace", () => {
    const result = filterBankEntries(entries, { tags: {}, search: "  homework  " });
    expect(result.map((e) => e.id)).toEqual(["b"]);
  });

  it("combines tag filter AND search", () => {
    const result = filterBankEntries(entries, {
      tags: { type: "success" },
      search: "lab",
    });
    expect(result.map((e) => e.id)).toEqual(["c"]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterBankEntries(entries, {
      tags: { type: "success" },
      search: "nonexistent-term",
    });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/bank/filterBankEntries.test.ts`
  Expected: FAIL because `src/bank/filterBankEntries.ts` does not exist (no `filterBankEntries` export).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/bank/filterBankEntries.ts
import type { BankEntry, BankTags } from "./types";

// BankEntry = { id; templateText; slots; tags: BankTags }
// BankTags  = { type; area; objective; tone } (all string)

export interface BankFilter {
  // Subset of tag keys to filter on; blank/undefined values are ignored.
  tags: Partial<BankTags>;
  // Free-text search over templateText; trimmed, case-insensitive.
  search: string;
}

/**
 * Pure filter over bank entries: keeps an entry only if every non-blank tag
 * filter matches exactly AND (when a search term is given) its templateText
 * contains the term, case-insensitively. Source order is preserved.
 */
export function filterBankEntries(
  entries: BankEntry[],
  filter: BankFilter
): BankEntry[] {
  const term = filter.search.trim().toLowerCase();
  const tagPairs = (Object.entries(filter.tags) as [keyof BankTags, string | undefined][])
    .filter(([, value]) => value !== undefined && value !== "");

  return entries.filter((entry) => {
    const tagsMatch = tagPairs.every(([key, value]) => entry.tags[key] === value);
    const searchMatches =
      term === "" || entry.templateText.toLowerCase().includes(term);
    return tagsMatch && searchMatches;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/bank/filterBankEntries.test.ts`
  Expected: PASS (all 8 cases green).

- [ ] **Step 5: Commit**
  `git add src/bank/filterBankEntries.ts src/bank/filterBankEntries.test.ts && git commit -m "Add filterBankEntries: tag filtering + text search"`

---

### Task K4: Firestore CRUD for `bankEntries`

**Files:**
- Create: `src/bank/bankRepo.ts`
- Test: `src/bank/bankRepo.test.ts`

- [ ] **Step 1: Write the failing test**

This test mocks the `firebase/firestore` modular SDK and asserts the repo calls the right APIs against the owner-scoped `bankEntries` collection.

```ts
// src/bank/bankRepo.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock the modular Firestore SDK ---
const mocks = vi.hoisted(() => ({
  collection: vi.fn(() => ({ __type: "collectionRef" })),
  doc: vi.fn(() => ({ id: "generated-id", __type: "docRef" })),
  addDoc: vi.fn(async () => ({ id: "new-id" })),
  setDoc: vi.fn(async () => undefined),
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
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/bank/bankRepo.test.ts`
  Expected: FAIL because `src/bank/bankRepo.ts` does not exist (no CRUD functions exported).

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/bank/bankRepo.test.ts`
  Expected: PASS (all 4 cases green).

- [ ] **Step 5: Commit**
  `git add src/bank/bankRepo.ts src/bank/bankRepo.test.ts && git commit -m "Add Firestore CRUD for bankEntries"`

---

### Task K5: Firestore security-rules test — non-owner cannot read bankEntries

**Files:**
- Create: `firestore.rules`
- Test: `src/bank/bankRules.test.ts`

- [ ] **Step 1: Write the failing test**

Run against the Firestore emulator with `@firebase/rules-unit-testing`. Proves an owner can read/write their `bankEntries` and a non-owner is denied.

```ts
// src/bank/bankRules.test.ts
import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
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
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `firebase emulators:exec --only firestore "npx vitest run src/bank/bankRules.test.ts"`
  Expected: FAIL because `firestore.rules` does not exist yet (read of the rules file throws / rules default deny is not in place). If `firestore.rules` already exists from Foundation, the new owner-scoped `bankEntries` allow path is missing, so the owner-write assertion fails.

- [ ] **Step 3: Write minimal implementation**

```
// firestore.rules
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Every teacher owns their subtree: a user may read/write only documents
    // under teachers/{their own uid}/**. Everyone else (incl. anon) is denied.
    match /teachers/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Default deny for anything not matched above.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `firebase emulators:exec --only firestore "npx vitest run src/bank/bankRules.test.ts"`
  Expected: PASS (owner read/write succeeds; stranger and anonymous reads are denied).

- [ ] **Step 5: Commit**
  `git add firestore.rules src/bank/bankRules.test.ts && git commit -m "Add owner-scoped Firestore rules + bankEntries rules test"`

---

### Task K6: `BankEntryForm` — create/edit form with live slot preview

**Files:**
- Create: `src/bank/BankEntryForm.tsx`
- Test: `src/bank/BankEntryForm.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/bank/BankEntryForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BankEntryForm } from "./BankEntryForm";

// BankEntryInput = {
//   templateText: string;
//   slots: { key: string; kind: "auto"|"fill"; hint: string }[];
//   tags: { type; area; objective; tone };
// }

describe("BankEntryForm", () => {
  it("shows derived slots live as the template text changes", () => {
    render(<BankEntryForm onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/template text/i), {
      target: { value: "Hi {name}, you grew in {area}." },
    });
    // auto slot labeled auto, fill slot labeled fill
    expect(screen.getByTestId("slot-name")).toHaveTextContent(/name/);
    expect(screen.getByTestId("slot-name")).toHaveTextContent(/auto/i);
    expect(screen.getByTestId("slot-area")).toHaveTextContent(/fill/i);
  });

  it("calls onSave with the template text, derived slots, and tags", () => {
    const onSave = vi.fn();
    render(<BankEntryForm onSave={onSave} />);

    fireEvent.change(screen.getByLabelText(/template text/i), {
      target: { value: "Hi {name}, your {area} improved." },
    });
    fireEvent.change(screen.getByLabelText(/^type$/i), {
      target: { value: "success" },
    });
    fireEvent.change(screen.getByLabelText(/^tone$/i), {
      target: { value: "warm" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      templateText: "Hi {name}, your {area} improved.",
      slots: [
        { key: "name", kind: "auto", hint: "" },
        { key: "area", kind: "fill", hint: "" },
      ],
      tags: { type: "success", area: "", objective: "", tone: "warm" },
    });
  });

  it("prefills fields when editing an existing entry", () => {
    render(
      <BankEntryForm
        initial={{
          templateText: "Nice work {name}.",
          slots: [{ key: "name", kind: "auto", hint: "" }],
          tags: { type: "success", area: "writing", objective: "", tone: "warm" },
        }}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/template text/i)).toHaveValue("Nice work {name}.");
    expect(screen.getByLabelText(/^area$/i)).toHaveValue("writing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/bank/BankEntryForm.test.tsx`
  Expected: FAIL because `src/bank/BankEntryForm.tsx` does not exist (no `BankEntryForm` export).

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/bank/BankEntryForm.tsx
import { useMemo, useState } from "react";
import { makeBankEntryInput, EMPTY_TAGS } from "./types";
import type { BankEntryInput, BankTags } from "./types";
import { extractSlots } from "./extractSlots";

// BankEntryInput = { templateText; slots; tags: BankTags }
// BankTags = { type; area; objective; tone }

const TAG_KEYS: (keyof BankTags)[] = ["type", "area", "objective", "tone"];

interface BankEntryFormProps {
  initial?: BankEntryInput;
  onSave: (input: BankEntryInput) => void;
}

export function BankEntryForm({ initial, onSave }: BankEntryFormProps) {
  const [templateText, setTemplateText] = useState(initial?.templateText ?? "");
  const [tags, setTags] = useState<BankTags>(initial?.tags ?? { ...EMPTY_TAGS });

  // Live-derived slots for the preview; recomputed as the text changes.
  const slots = useMemo(() => extractSlots(templateText), [templateText]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(makeBankEntryInput({ templateText, tags }));
  }

  function setTag(key: keyof BankTags, value: string) {
    setTags((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="templateText">Template text</label>
      <textarea
        id="templateText"
        value={templateText}
        onChange={(e) => setTemplateText(e.target.value)}
      />

      <ul aria-label="slots">
        {slots.map((slot) => (
          <li key={slot.key} data-testid={`slot-${slot.key}`}>
            {slot.key} — {slot.kind}
          </li>
        ))}
      </ul>

      {TAG_KEYS.map((key) => (
        <div key={key}>
          <label htmlFor={`tag-${key}`}>{key}</label>
          <input
            id={`tag-${key}`}
            value={tags[key]}
            onChange={(e) => setTag(key, e.target.value)}
          />
        </div>
      ))}

      <button type="submit">Save</button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/bank/BankEntryForm.test.tsx`
  Expected: PASS (slot preview updates live; onSave receives `{templateText, slots, tags}`; edit prefill works).

- [ ] **Step 5: Commit**
  `git add src/bank/BankEntryForm.tsx src/bank/BankEntryForm.test.tsx && git commit -m "Add BankEntryForm create/edit form with live slot preview"`

---

### Task K7: `BankList` — tag filter + search wired to `filterBankEntries`

**Files:**
- Create: `src/bank/BankList.tsx`
- Test: `src/bank/BankList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/bank/BankList.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BankList } from "./BankList";

// BankEntry = { id; templateText; slots; tags: { type; area; objective; tone } }
const entries = [
  {
    id: "a",
    templateText: "Hi {name}, your writing improved.",
    slots: [{ key: "name", kind: "auto" as const, hint: "" }],
    tags: { type: "success", area: "writing", objective: "", tone: "warm" },
  },
  {
    id: "b",
    templateText: "Let's work on homework deadlines.",
    slots: [],
    tags: { type: "growth", area: "responsibility", objective: "", tone: "firm" },
  },
  {
    id: "c",
    templateText: "Strong lab writing this term.",
    slots: [],
    tags: { type: "success", area: "science", objective: "", tone: "warm" },
  },
];

describe("BankList", () => {
  it("renders all entries initially", () => {
    render(<BankList entries={entries} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("filters by search text over template text", () => {
    render(<BankList entries={entries} />);
    fireEvent.change(screen.getByLabelText(/search/i), {
      target: { value: "homework" },
    });
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(/homework deadlines/i);
  });

  it("filters by the type tag", () => {
    render(<BankList entries={entries} />);
    fireEvent.change(screen.getByLabelText(/filter by type/i), {
      target: { value: "success" },
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("combines a type tag filter with a search term", () => {
    render(<BankList entries={entries} />);
    fireEvent.change(screen.getByLabelText(/filter by type/i), {
      target: { value: "success" },
    });
    fireEvent.change(screen.getByLabelText(/search/i), {
      target: { value: "lab" },
    });
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(/strong lab writing/i);
  });

  it("shows an empty message when nothing matches", () => {
    render(<BankList entries={entries} />);
    fireEvent.change(screen.getByLabelText(/search/i), {
      target: { value: "no-such-thing" },
    });
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText(/no entries match/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/bank/BankList.test.tsx`
  Expected: FAIL because `src/bank/BankList.tsx` does not exist (no `BankList` export).

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/bank/BankList.tsx
import { useMemo, useState } from "react";
import { filterBankEntries } from "./filterBankEntries";
import type { BankEntry, BankTags } from "./types";

// BankEntry = { id; templateText; slots; tags: BankTags }
// filterBankEntries(entries, { tags: Partial<BankTags>; search: string })

interface BankListProps {
  entries: BankEntry[];
}

export function BankList({ entries }: BankListProps) {
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const tags = useMemo<Partial<BankTags>>(
    () => (typeFilter ? { type: typeFilter } : {}),
    [typeFilter]
  );

  const visible = useMemo(
    () => filterBankEntries(entries, { tags, search }),
    [entries, tags, search]
  );

  // Distinct type values present in the bank, for the filter dropdown.
  const typeOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.tags.type).filter(Boolean))),
    [entries]
  );

  return (
    <div>
      <label htmlFor="bank-search">Search</label>
      <input
        id="bank-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <label htmlFor="bank-type-filter">Filter by type</label>
      <select
        id="bank-type-filter"
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
      >
        <option value="">All</option>
        {typeOptions.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {visible.length === 0 ? (
        <p>No entries match the current filters.</p>
      ) : (
        <ul>
          {visible.map((entry) => (
            <li key={entry.id}>{entry.templateText}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/bank/BankList.test.tsx`
  Expected: PASS (initial render shows all; search, type filter, combined filter, and empty-state all work).

- [ ] **Step 5: Commit**
  `git add src/bank/BankList.tsx src/bank/BankList.test.tsx && git commit -m "Add BankList with tag filter + search wired to filterBankEntries"`

### Task K8: Seed comment bank — 8th-grade U.S. History, Mr. B.'s voice

Ships a starter library of comment templates so the teacher isn't staring at an empty bank on day one. Entries are real 8th-grade social studies comments in Mr. B.'s first-person voice, tagged across the five areas (CERs & Argumentation, Discussion & Debate, Research & Sources, Collaboration & Projects, Professionalism) and the four types (Success, Growth, Behavior, Skill). The seed is plain data plus an idempotent installer that writes any not-yet-present entries into `teachers/{uid}/bankEntries`.

**Files:**
- Create: `src/bank/seedBank.ts`
- Create: `src/bank/seedBank.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/bank/seedBank.test.ts
import { describe, it, expect } from 'vitest';
import { SEED_BANK, seedKeyOf } from './seedBank';
import type { BankEntry } from '../types';
import { extractSlots } from './extractSlots'; // (key, kind) extractor from Task K1

describe('seed comment bank', () => {
  it('ships a meaningful number of entries', () => {
    expect(SEED_BANK.length).toBeGreaterThanOrEqual(15);
  });

  it('covers all five areas and all four types', () => {
    const areas = new Set(SEED_BANK.map((e) => e.tags.area));
    const types = new Set(SEED_BANK.map((e) => e.tags.type));
    expect(areas).toEqual(
      new Set(['cer', 'discussion', 'research', 'collaboration', 'professionalism']),
    );
    expect(types).toEqual(new Set(['success', 'growth', 'behavior', 'skill']));
  });

  it('every entry declares slots that exactly match the tokens in its templateText', () => {
    for (const e of SEED_BANK) {
      const tokenKeys = extractSlots(e.templateText).map((s) => s.key).sort();
      const declaredKeys = e.slots.map((s) => s.key).sort();
      expect(declaredKeys).toEqual(tokenKeys);
    }
  });

  it('uses {name} (auto) and at least one {fill} token in Mr. B. voice', () => {
    const cer = SEED_BANK.find((e) => e.id === 'seed-cer-success-1')!;
    expect(cer.templateText).toContain('{name}');
    expect(cer.slots.some((s) => s.kind === 'fill')).toBe(true);
    // first-person voice
    expect(cer.templateText.toLowerCase()).toMatch(/\bi (was|noticed|loved|saw)\b/);
  });

  it('seedKeyOf is stable and unique per entry (for idempotent install)', () => {
    const keys = SEED_BANK.map(seedKeyOf);
    expect(new Set(keys).size).toBe(SEED_BANK.length);
    expect(seedKeyOf(SEED_BANK[0])).toBe(SEED_BANK[0].id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/bank/seedBank.test.ts`
Expected: FAIL — `Failed to resolve import "./seedBank"` (the module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/bank/seedBank.ts
import type { BankEntry, Slot } from '../types';
import { extractSlots } from './extractSlots';

// Build a BankEntry from text + tags, deriving slots from the {tokens} in the text
// so the declared slots can never drift from the template. id must be unique & stable.
function entry(
  id: string,
  templateText: string,
  tags: BankEntry['tags'],
): BankEntry {
  const slots: Slot[] = extractSlots(templateText);
  return { id, templateText, slots, tags };
}

// area codes: cer | discussion | research | collaboration | professionalism
// type codes: success | growth | behavior | skill
export const SEED_BANK: BankEntry[] = [
  // ---- CERs & Argumentation ----
  entry(
    'seed-cer-success-1',
    "{name}, your CER on {cer_topic} was one of the strongest in class — your claim was sharp and you backed it with solid evidence from the documents. I was especially impressed when {personal_detail}.",
    { type: 'success', area: 'cer', objective: 'argumentation', tone: 'encouraging' },
  ),
  entry(
    'seed-cer-skill-1',
    "{name}, you've really grown at using reasoning to connect your evidence back to your claim. When I read your work on {cer_topic}, I could follow exactly why your evidence mattered.",
    { type: 'skill', area: 'cer', objective: 'reasoning', tone: 'warm' },
  ),
  entry(
    'seed-cer-growth-1',
    "{name}, a goal for next year: push your reasoning a step further. Your claims and evidence are strong — I'd love to see you explain {growth_detail} so the reader feels the full weight of your argument.",
    { type: 'growth', area: 'cer', objective: 'reasoning', tone: 'direct' },
  ),

  // ---- Discussion & Debate ----
  entry(
    'seed-discussion-success-1',
    "{name}, you brought real energy to our discussions this year. In our debate on {debate_topic}, you listened closely and then made a point that moved the whole conversation forward.",
    { type: 'success', area: 'discussion', objective: 'participation', tone: 'encouraging' },
  ),
  entry(
    'seed-discussion-growth-1',
    "{name}, one thing to keep building is speaking up earlier in our debates — when you do jump in, your points land, so I'd love to hear from you sooner. You can always reach me at {teacher_email} if you'd like to talk it through.",
    { type: 'growth', area: 'discussion', objective: 'participation', tone: 'warm' },
  ),
  entry(
    'seed-discussion-behavior-1',
    "{name}, I noticed how respectfully you disagreed during our Socratic seminars — you challenged ideas without ever putting anyone down. That's exactly the kind of citizen our classroom needs.",
    { type: 'behavior', area: 'discussion', objective: 'respectful-disagreement', tone: 'warm' },
  ),

  // ---- Research & Sources ----
  entry(
    'seed-research-skill-1',
    "{name}, you've become a careful researcher. On {research_topic} you didn't just grab the first source — you checked whether it was reliable and weighed primary against secondary sources.",
    { type: 'skill', area: 'research', objective: 'source-analysis', tone: 'encouraging' },
  ),
  entry(
    'seed-research-success-1',
    "{name}, your research this year stood out. I saw you {personal_detail}, and it showed me you're ready for the kind of source work high school will ask of you.",
    { type: 'success', area: 'research', objective: 'source-analysis', tone: 'warm' },
  ),
  entry(
    'seed-research-growth-1',
    "{name}, to grow next year: slow down and cross-check your sources before you build on them. You have great instincts — {growth_detail} will make your research airtight.",
    { type: 'growth', area: 'research', objective: 'source-analysis', tone: 'direct' },
  ),

  // ---- Collaboration & Projects ----
  entry(
    'seed-collaboration-behavior-1',
    "{name}, you were a teammate others could count on. During {project_name} you did your share and helped your group stay on track — that reliability matters more than you know.",
    { type: 'behavior', area: 'collaboration', objective: 'reliability', tone: 'warm' },
  ),
  entry(
    'seed-collaboration-success-1',
    "{name}, watching you in our group work and station activities was a highlight. You {personal_detail}, and your group was better for having you in it.",
    { type: 'success', area: 'collaboration', objective: 'teamwork', tone: 'encouraging' },
  ),
  entry(
    'seed-collaboration-growth-1',
    "{name}, a next step in group work: trust your own voice a little more. You have good ideas — sharing them sooner with your team, like when {growth_detail}, will make you a leader, not just a contributor.",
    { type: 'growth', area: 'collaboration', objective: 'leadership', tone: 'warm' },
  ),

  // ---- Professionalism ----
  entry(
    'seed-professionalism-behavior-1',
    "{name}, thank you for coming in on time and ready to learn, day after day. It's a quiet habit that made our classroom run, and it will carry you a long way.",
    { type: 'behavior', area: 'professionalism', objective: 'readiness', tone: 'warm' },
  ),
  entry(
    'seed-professionalism-success-1',
    "{name}, I want to recognize how you handled missing work this year — when you were out, you checked in and made it up without me having to chase you. That's real responsibility.",
    { type: 'success', area: 'professionalism', objective: 'responsibility', tone: 'encouraging' },
  ),
  entry(
    'seed-professionalism-growth-1',
    "{name}, one habit to build next year: communicate with your teacher early when you're stuck or behind. I'm always glad to help — reach me at {teacher_email} — and the students who ask are the ones who grow fastest.",
    { type: 'growth', area: 'professionalism', objective: 'self-advocacy', tone: 'direct' },
  ),
  entry(
    'seed-professionalism-skill-1',
    "{name}, you came prepared — materials out, assignment ready, focused from the bell. That self-management is a skill, and you've clearly worked at it.",
    { type: 'skill', area: 'professionalism', objective: 'self-management', tone: 'warm' },
  ),
];

// Stable identity for idempotent install: the entry's own id.
export function seedKeyOf(e: BankEntry): string {
  return e.id;
}

// Idempotent installer. `existingIds` are the ids already in the teacher's bank;
// `write` persists one entry. Returns how many new entries were installed.
export async function installSeedBank(
  existingIds: Set<string>,
  write: (e: BankEntry) => Promise<void>,
): Promise<number> {
  let installed = 0;
  for (const e of SEED_BANK) {
    if (existingIds.has(seedKeyOf(e))) continue;
    await write(e);
    installed += 1;
  }
  return installed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/bank/seedBank.test.ts`
Expected: PASS — all assertions green (count ≥ 15, all areas/types covered, declared slots match tokens, Mr. B. voice present, stable keys).

- [ ] **Step 5: Commit**

```bash
git add src/bank/seedBank.ts src/bank/seedBank.test.ts
git commit -m "Seed comment bank — 8th-grade U.S. History in Mr. B.'s voice

16 starter templates across CERs, discussion/debate, research, collaboration,
and professionalism, tagged by type (success/growth/behavior/skill). Slots are
derived from the template tokens so they can't drift. Idempotent installer skips
entries already present.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **Wire-up note (covered by Task K7 BankList):** add a one-time "Load starter comments" button on the Bank screen that calls `installSeedBank(existingIds, write)` with the teacher's current bank ids and the Firestore `addBankEntry` from Task K4. It's safe to click more than once — already-present entries are skipped.

---

## Step C — Compose

### Task C1: Pure slot-filling function (`fillSlots`)

**Files:**
- Create: `src/compose/fillSlots.ts`
- Test: `src/compose/fillSlots.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/compose/fillSlots.test.ts
import { describe, it, expect } from 'vitest';
import { fillSlots, UnfilledSlotError } from './fillSlots';

// Shapes restated from the Firestore data model (spec):
// BankEntry: { templateText: string; slots: { key: string; kind: 'auto' | 'fill'; hint?: string }[] }
// Student:   { name: string; email: string; period?: string }
// ClassMeta: { semester?: string }

const baseStudent = { name: 'Carlos Diaz', email: 'carlos@example.com', period: '3' };
const baseClass = { semester: 'Spring 2026' };

describe('fillSlots', () => {
  it('resolves auto slots (name, semester) from student and class', () => {
    const entry = {
      templateText: 'Hi {name}, great work this {semester}.',
      slots: [
        { key: 'name', kind: 'auto' as const },
        { key: 'semester', kind: 'auto' as const },
      ],
    };
    const result = fillSlots(entry, baseStudent, baseClass, {});
    expect(result).toBe('Hi Carlos Diaz, great work this Spring 2026.');
  });

  it('substitutes provided fill-slot values', () => {
    const entry = {
      templateText: 'You showed real growth in {topic}.',
      slots: [{ key: 'topic', kind: 'fill' as const, hint: 'a subject area' }],
    };
    const result = fillSlots(entry, baseStudent, baseClass, { topic: 'cell biology' });
    expect(result).toBe('You showed real growth in cell biology.');
  });

  it('mixes auto and fill slots in one template', () => {
    const entry = {
      templateText: '{name}, your {topic} essay this {semester} was excellent.',
      slots: [
        { key: 'name', kind: 'auto' as const },
        { key: 'topic', kind: 'fill' as const },
        { key: 'semester', kind: 'auto' as const },
      ],
    };
    const result = fillSlots(entry, baseStudent, baseClass, { topic: 'genetics' });
    expect(result).toBe('Carlos Diaz, your genetics essay this Spring 2026 was excellent.');
  });

  it('replaces every occurrence of a repeated slot', () => {
    const entry = {
      templateText: '{name}, keep it up {name}!',
      slots: [{ key: 'name', kind: 'auto' as const }],
    };
    const result = fillSlots(entry, baseStudent, baseClass, {});
    expect(result).toBe('Carlos Diaz, keep it up Carlos Diaz!');
  });

  it('throws UnfilledSlotError when a fill slot has no value', () => {
    const entry = {
      templateText: 'Great job on {topic}.',
      slots: [{ key: 'topic', kind: 'fill' as const, hint: 'a subject' }],
    };
    expect(() => fillSlots(entry, baseStudent, baseClass, {})).toThrow(UnfilledSlotError);
    expect(() => fillSlots(entry, baseStudent, baseClass, {})).toThrow(/topic/);
  });

  it('throws UnfilledSlotError when a fill slot value is blank/whitespace', () => {
    const entry = {
      templateText: 'Great job on {topic}.',
      slots: [{ key: 'topic', kind: 'fill' as const }],
    };
    expect(() => fillSlots(entry, baseStudent, baseClass, { topic: '   ' })).toThrow(
      UnfilledSlotError,
    );
  });

  it('throws when an auto slot key is not a known auto field', () => {
    const entry = {
      templateText: 'Hello {mystery}.',
      slots: [{ key: 'mystery', kind: 'auto' as const }],
    };
    expect(() => fillSlots(entry, baseStudent, baseClass, {})).toThrow(/mystery/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/compose/fillSlots.test.ts`
  Expected: FAIL because `src/compose/fillSlots.ts` does not exist yet (module not found / `fillSlots` and `UnfilledSlotError` undefined).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/compose/fillSlots.ts

export interface Slot {
  key: string;
  kind: 'auto' | 'fill';
  hint?: string;
}

export interface BankEntryLike {
  templateText: string;
  slots: Slot[];
}

export interface StudentLike {
  name: string;
  email: string;
  period?: string;
}

export interface ClassMetaLike {
  semester?: string;
}

export class UnfilledSlotError extends Error {
  constructor(public readonly slotKey: string) {
    super(`Unfilled slot: "${slotKey}"`);
    this.name = 'UnfilledSlotError';
  }
}

/** Auto slots resolve from the student/class; everything else is teacher-provided. */
function resolveAuto(
  key: string,
  student: StudentLike,
  classMeta: ClassMetaLike,
): string {
  switch (key) {
    case 'name':
      return student.name;
    case 'semester':
      return classMeta.semester ?? '';
    default:
      throw new Error(`Unknown auto slot: "${key}"`);
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pure: given a bank entry, a student, class metadata, and the teacher's fill answers,
 * return the finished message text. Throws UnfilledSlotError if a "fill" slot is empty.
 */
export function fillSlots(
  entry: BankEntryLike,
  student: StudentLike,
  classMeta: ClassMetaLike,
  slotValues: Record<string, string>,
): string {
  let text = entry.templateText;

  for (const slot of entry.slots) {
    let value: string;
    if (slot.kind === 'auto') {
      value = resolveAuto(slot.key, student, classMeta);
    } else {
      const raw = slotValues[slot.key];
      if (raw == null || raw.trim() === '') {
        throw new UnfilledSlotError(slot.key);
      }
      value = raw;
    }
    const token = new RegExp(escapeRegExp(`{${slot.key}}`), 'g');
    text = text.replace(token, value);
  }

  return text;
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/compose/fillSlots.test.ts`
  Expected: PASS (all 7 cases green).

- [ ] **Step 5: Commit**
  `git add src/compose/fillSlots.ts src/compose/fillSlots.test.ts && git commit -m "Add pure slot-filling function with unfilled-slot guard"`

---

### Task C2: Assemble a full message from multiple bank entries (`assembleMessage`)

**Files:**
- Create: `src/compose/assembleMessage.ts`
- Test: `src/compose/assembleMessage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/compose/assembleMessage.test.ts
import { describe, it, expect } from 'vitest';
import { assembleMessage } from './assembleMessage';
import { UnfilledSlotError } from './fillSlots';

// Shapes restated from the data model (spec):
// BankEntry: { id: string; templateText: string; slots: { key; kind: 'auto'|'fill'; hint? }[] }
// Student:   { name: string; email: string; period?: string }
// ClassMeta: { semester?: string }

const student = { name: 'Mia Lopez', email: 'mia@example.com', period: '3' };
const classMeta = { semester: 'Spring 2026' };

const entries = [
  {
    id: 'e1',
    templateText: 'Hi {name},',
    slots: [{ key: 'name', kind: 'auto' as const }],
  },
  {
    id: 'e2',
    templateText: 'You grew a lot in {topic} this {semester}.',
    slots: [
      { key: 'topic', kind: 'fill' as const },
      { key: 'semester', kind: 'auto' as const },
    ],
  },
];

describe('assembleMessage', () => {
  it('joins shared header + filled entries with blank lines', () => {
    const result = assembleMessage({
      header: 'Dear student,',
      entries,
      student,
      classMeta,
      slotValues: { topic: 'genetics' },
    });
    expect(result).toBe(
      'Dear student,\n\nHi Mia Lopez,\n\nYou grew a lot in genetics this Spring 2026.',
    );
  });

  it('omits the header when it is empty', () => {
    const result = assembleMessage({
      header: '',
      entries: [entries[0]],
      student,
      classMeta,
      slotValues: {},
    });
    expect(result).toBe('Hi Mia Lopez,');
  });

  it('propagates UnfilledSlotError from any entry', () => {
    expect(() =>
      assembleMessage({
        header: '',
        entries,
        student,
        classMeta,
        slotValues: {}, // topic missing
      }),
    ).toThrow(UnfilledSlotError);
  });

  it('returns empty string when there is no header and no entries', () => {
    const result = assembleMessage({
      header: '',
      entries: [],
      student,
      classMeta,
      slotValues: {},
    });
    expect(result).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/compose/assembleMessage.test.ts`
  Expected: FAIL because `src/compose/assembleMessage.ts` does not exist (`assembleMessage` is undefined).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/compose/assembleMessage.ts
import {
  fillSlots,
  type BankEntryLike,
  type StudentLike,
  type ClassMetaLike,
} from './fillSlots';

export interface AssembleInput {
  header: string;
  entries: (BankEntryLike & { id: string })[];
  student: StudentLike;
  classMeta: ClassMetaLike;
  slotValues: Record<string, string>;
}

/**
 * Build the full finalText for one student's message:
 * shared header (if any) followed by each bank entry filled in, blank-line separated.
 * Throws UnfilledSlotError (from fillSlots) if any "fill" slot is empty.
 */
export function assembleMessage(input: AssembleInput): string {
  const { header, entries, student, classMeta, slotValues } = input;

  const parts: string[] = [];
  if (header.trim() !== '') {
    parts.push(header);
  }
  for (const entry of entries) {
    parts.push(fillSlots(entry, student, classMeta, slotValues));
  }

  return parts.join('\n\n');
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/compose/assembleMessage.test.ts`
  Expected: PASS (all 4 cases green).

- [ ] **Step 5: Commit**
  `git add src/compose/assembleMessage.ts src/compose/assembleMessage.test.ts && git commit -m "Add assembleMessage to combine header + filled bank entries"`

---

### Task C3: Roster progress helper (`rosterProgress`)

**Files:**
- Create: `src/compose/rosterProgress.ts`
- Test: `src/compose/rosterProgress.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/compose/rosterProgress.test.ts
import { describe, it, expect } from 'vitest';
import { rosterProgress } from './rosterProgress';

// Shapes restated from the data model (spec):
// Student: { id: string; name: string }
// Message: { studentId: string; finalText: string; status: 'draft'|'sent'|'failed' }

const students = [
  { id: 's1', name: 'Ana' },
  { id: 's2', name: 'Ben' },
  { id: 's3', name: 'Cy' },
];

describe('rosterProgress', () => {
  it('counts a student done when a message has non-empty finalText', () => {
    const messages = [{ studentId: 's1', finalText: 'Hi Ana', status: 'draft' as const }];
    const result = rosterProgress(students, messages);
    expect(result.doneCount).toBe(1);
    expect(result.total).toBe(3);
    expect(result.doneIds).toEqual(new Set(['s1']));
  });

  it('does not count an empty or whitespace-only draft as done', () => {
    const messages = [
      { studentId: 's1', finalText: '', status: 'draft' as const },
      { studentId: 's2', finalText: '   ', status: 'draft' as const },
    ];
    const result = rosterProgress(students, messages);
    expect(result.doneCount).toBe(0);
    expect(result.doneIds.size).toBe(0);
  });

  it('counts every student with content regardless of status', () => {
    const messages = [
      { studentId: 's1', finalText: 'a', status: 'sent' as const },
      { studentId: 's2', finalText: 'b', status: 'failed' as const },
      { studentId: 's3', finalText: 'c', status: 'draft' as const },
    ];
    const result = rosterProgress(students, messages);
    expect(result.doneCount).toBe(3);
    expect(result.doneIds).toEqual(new Set(['s1', 's2', 's3']));
  });

  it('ignores messages for unknown students', () => {
    const messages = [{ studentId: 'ghost', finalText: 'x', status: 'draft' as const }];
    const result = rosterProgress(students, messages);
    expect(result.doneCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/compose/rosterProgress.test.ts`
  Expected: FAIL because `src/compose/rosterProgress.ts` does not exist (`rosterProgress` undefined).

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/compose/rosterProgress.test.ts`
  Expected: PASS (all 4 cases green).

- [ ] **Step 5: Commit**
  `git add src/compose/rosterProgress.ts src/compose/rosterProgress.test.ts && git commit -m "Add rosterProgress helper for compose left-panel tracking"`

---

### Task C4: Bank-picker tag filter (`filterBankByTags`)

**Files:**
- Create: `src/compose/filterBankByTags.ts`
- Test: `src/compose/filterBankByTags.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/compose/filterBankByTags.test.ts
import { describe, it, expect } from 'vitest';
import { filterBankByTags } from './filterBankByTags';

// Shapes restated from the data model (spec):
// BankEntry: { id; templateText; slots; tags: { type?; area?; objective?; tone? } }
// TagFilter: { type?; area?; objective?; tone? }  (omitted/empty key = "any")

const bank = [
  { id: 'b1', templateText: 'A', slots: [], tags: { type: 'success', area: 'lab', tone: 'warm' } },
  { id: 'b2', templateText: 'B', slots: [], tags: { type: 'growth', area: 'lab', tone: 'firm' } },
  { id: 'b3', templateText: 'C', slots: [], tags: { type: 'success', area: 'essay', tone: 'warm' } },
];

describe('filterBankByTags', () => {
  it('returns all entries when filter is empty', () => {
    expect(filterBankByTags(bank, {}).map((e) => e.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('filters by a single tag', () => {
    expect(filterBankByTags(bank, { type: 'success' }).map((e) => e.id)).toEqual(['b1', 'b3']);
  });

  it('ANDs multiple tag constraints', () => {
    expect(filterBankByTags(bank, { type: 'success', tone: 'warm' }).map((e) => e.id)).toEqual([
      'b1',
      'b3',
    ]);
    expect(filterBankByTags(bank, { area: 'lab', tone: 'firm' }).map((e) => e.id)).toEqual(['b2']);
  });

  it('treats empty-string filter values as "any"', () => {
    expect(filterBankByTags(bank, { type: '', area: 'essay' }).map((e) => e.id)).toEqual(['b3']);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterBankByTags(bank, { type: 'success', area: 'lab', tone: 'firm' })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/compose/filterBankByTags.test.ts`
  Expected: FAIL because `src/compose/filterBankByTags.ts` does not exist (`filterBankByTags` undefined).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/compose/filterBankByTags.ts

export interface BankTags {
  type?: string;
  area?: string;
  objective?: string;
  tone?: string;
}

export interface BankEntry {
  id: string;
  templateText: string;
  slots: { key: string; kind: 'auto' | 'fill'; hint?: string }[];
  tags: BankTags;
}

export type TagFilter = BankTags;

const TAG_KEYS: (keyof BankTags)[] = ['type', 'area', 'objective', 'tone'];

/**
 * Filter the bank for the right-panel picker. Each provided, non-empty filter key must
 * match the entry's tag exactly; omitted or empty-string keys mean "any". Multiple keys AND.
 */
export function filterBankByTags(entries: BankEntry[], filter: TagFilter): BankEntry[] {
  return entries.filter((entry) =>
    TAG_KEYS.every((key) => {
      const want = filter[key];
      if (want == null || want === '') return true;
      return entry.tags[key] === want;
    }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/compose/filterBankByTags.test.ts`
  Expected: PASS (all 5 cases green).

- [ ] **Step 5: Commit**
  `git add src/compose/filterBankByTags.ts src/compose/filterBankByTags.test.ts && git commit -m "Add tag filter for compose bank picker"`

---

### Task C5: "Save & next" roster advance helper (`nextStudentIndex`)

**Files:**
- Create: `src/compose/nextStudentIndex.ts`
- Test: `src/compose/nextStudentIndex.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/compose/nextStudentIndex.test.ts
import { describe, it, expect } from 'vitest';
import { nextStudentIndex } from './nextStudentIndex';

describe('nextStudentIndex', () => {
  it('advances to the next index when not at the end', () => {
    expect(nextStudentIndex(0, 5)).toBe(1);
    expect(nextStudentIndex(3, 5)).toBe(4);
  });

  it('clamps at the last index (no wrap past the end)', () => {
    expect(nextStudentIndex(4, 5)).toBe(4);
  });

  it('returns 0 for an empty roster', () => {
    expect(nextStudentIndex(0, 0)).toBe(0);
  });

  it('clamps a current index that is already out of range', () => {
    expect(nextStudentIndex(10, 5)).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/compose/nextStudentIndex.test.ts`
  Expected: FAIL because `src/compose/nextStudentIndex.ts` does not exist (`nextStudentIndex` undefined).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/compose/nextStudentIndex.ts

/**
 * "Save & next" advance: move to the next student, clamped at the last index.
 * Returns 0 for an empty roster. Pure so the compose screen's advance logic is testable.
 */
export function nextStudentIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  const last = total - 1;
  if (current >= last) return last;
  return current + 1;
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/compose/nextStudentIndex.test.ts`
  Expected: PASS (all 4 cases green).

- [ ] **Step 5: Commit**
  `git add src/compose/nextStudentIndex.ts src/compose/nextStudentIndex.test.ts && git commit -m "Add nextStudentIndex helper for Save & next advance"`

---

### Task C6: Message-builder panel — header + spellcheck editor + Save & next (`MessageBuilder`)

**Files:**
- Create: `src/compose/MessageBuilder.tsx`
- Test: `src/compose/MessageBuilder.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/compose/MessageBuilder.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageBuilder } from './MessageBuilder';

describe('MessageBuilder', () => {
  it('renders the shared header and a spellcheck-enabled editor with the current text', () => {
    render(
      <MessageBuilder
        studentName="Ana Diaz"
        header="Dear student,"
        finalText="Hi Ana Diaz"
        onTextChange={() => {}}
        onSaveAndNext={() => {}}
      />,
    );
    expect(screen.getByText('Dear student,')).toBeInTheDocument();
    const editor = screen.getByRole('textbox', { name: /message/i });
    expect(editor).toHaveValue('Hi Ana Diaz');
    expect(editor).toHaveAttribute('spellcheck', 'true');
  });

  it('shows whose message is being composed', () => {
    render(
      <MessageBuilder
        studentName="Ben Ng"
        header=""
        finalText=""
        onTextChange={() => {}}
        onSaveAndNext={() => {}}
      />,
    );
    expect(screen.getByText(/Ben Ng/)).toBeInTheDocument();
  });

  it('calls onTextChange with the new value as the teacher edits', () => {
    const onTextChange = vi.fn();
    render(
      <MessageBuilder
        studentName="Ana"
        header=""
        finalText="Hi"
        onTextChange={onTextChange}
        onSaveAndNext={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
      target: { value: 'Hi there' },
    });
    expect(onTextChange).toHaveBeenCalledWith('Hi there');
  });

  it('calls onSaveAndNext when the Save & next button is clicked', () => {
    const onSaveAndNext = vi.fn();
    render(
      <MessageBuilder
        studentName="Ana"
        header=""
        finalText="Hi"
        onTextChange={() => {}}
        onSaveAndNext={onSaveAndNext}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save & next/i }));
    expect(onSaveAndNext).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/compose/MessageBuilder.test.tsx`
  Expected: FAIL because `src/compose/MessageBuilder.tsx` does not exist (`MessageBuilder` undefined).

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/compose/MessageBuilder.tsx

export interface MessageBuilderProps {
  studentName: string;
  header: string;
  finalText: string;
  onTextChange: (value: string) => void;
  onSaveAndNext: () => void;
}

/**
 * Middle panel of the compose screen: shows whose message this is, the shared header,
 * a spellcheck-enabled textarea bound to finalText, and the Save & next button.
 */
export function MessageBuilder({
  studentName,
  header,
  finalText,
  onTextChange,
  onSaveAndNext,
}: MessageBuilderProps) {
  return (
    <section aria-label="Message builder">
      <h2>Composing for {studentName}</h2>

      {header.trim() !== '' && (
        <p className="shared-header" data-testid="shared-header">
          {header}
        </p>
      )}

      <textarea
        aria-label="Message"
        spellCheck
        value={finalText}
        onChange={(e) => onTextChange(e.target.value)}
        rows={12}
      />

      <button type="button" onClick={onSaveAndNext}>
        Save & next
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/compose/MessageBuilder.test.tsx`
  Expected: PASS (all 4 cases green).

- [ ] **Step 5: Commit**
  `git add src/compose/MessageBuilder.tsx src/compose/MessageBuilder.test.tsx && git commit -m "Add MessageBuilder middle panel with spellcheck editor and Save & next"`

---

### Task C20: `createBatch` data function

**Step 1 — Failing test.** Create `src/firebase/batches.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setDoc, doc, getDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { createBatch } from './batches';

let testEnv: RulesTestEnvironment;
const UID = 'teacher-1';

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'feedback-batches-test',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
  await testEnv.clearFirestore();
});

function db(): Firestore {
  // authenticated teacher context, cast to the client Firestore type the fns expect
  return testEnv.authenticatedContext(UID).firestore() as unknown as Firestore;
}

describe('createBatch', () => {
  it('writes teachers/{uid}/batches/{batchId} with draft status and returns the id', async () => {
    const database = db();
    const batchId = await createBatch(database, UID, {
      classId: 'class-9',
      sharedHeader: 'End of year — Period 3 Biology',
    });

    expect(typeof batchId).toBe('string');
    expect(batchId.length).toBeGreaterThan(0);

    const snap = await getDoc(doc(database, `teachers/${UID}/batches/${batchId}`));
    expect(snap.exists()).toBe(true);
    expect(snap.data()).toMatchObject({
      classId: 'class-9',
      sharedHeader: 'End of year — Period 3 Biology',
      status: 'draft',
    });
  });
});
```

**Step 2 — Run, expect FAIL** (module `./batches` does not exist yet):

```
npx vitest run src/firebase/batches.test.ts
```

Expected: `Failed to resolve import "./batches"` / `createBatch is not a function`.

**Step 3 — Minimal implementation.** Create `src/firebase/batches.ts`:

```typescript
import {
  collection,
  doc,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Batch } from '../types';

/** Fields the caller supplies; id + status are owned by createBatch. */
export type NewBatchInput = Pick<Batch, 'classId' | 'sharedHeader'>;

/**
 * Creates a draft batch at teachers/{uid}/batches/{batchId}.
 * Returns the generated batchId. `db` is passed in for testability.
 */
export async function createBatch(
  db: Firestore,
  uid: string,
  input: NewBatchInput,
): Promise<string> {
  const ref = doc(collection(db, `teachers/${uid}/batches`));
  const batch: Batch = {
    id: ref.id,
    classId: input.classId,
    sharedHeader: input.sharedHeader,
    status: 'draft',
  };
  await setDoc(ref, batch);
  return ref.id;
}
```

**Step 4 — Run, expect PASS:**

```
npx vitest run src/firebase/batches.test.ts
```

Expected: 1 passed.

**Step 5 — Commit:**

```
git add src/firebase/batches.ts src/firebase/batches.test.ts
git commit -m "feat(batches): createBatch writes draft batch under teachers/{uid}/batches"
```

---

### Task C21: `setBatchStatus` data function

**Step 1 — Failing test.** Append to `src/firebase/batches.test.ts`:

```typescript
import { setBatchStatus } from './batches';

describe('setBatchStatus', () => {
  it("updates an existing batch's status to 'sending' then 'sent'", async () => {
    const database = db();
    const batchId = await createBatch(database, UID, {
      classId: 'class-9',
      sharedHeader: 'EOY',
    });

    await setBatchStatus(database, UID, batchId, 'sending');
    let snap = await getDoc(doc(database, `teachers/${UID}/batches/${batchId}`));
    expect(snap.data()?.status).toBe('sending');

    await setBatchStatus(database, UID, batchId, 'sent');
    snap = await getDoc(doc(database, `teachers/${UID}/batches/${batchId}`));
    expect(snap.data()?.status).toBe('sent');
  });
});
```

Also add `getDoc, doc` to the existing `firebase/firestore` import at the top of the test file if not already present (they are imported in Task 4.6).

**Step 2 — Run, expect FAIL:**

```
npx vitest run src/firebase/batches.test.ts -t setBatchStatus
```

Expected: `setBatchStatus is not a function` / import resolution error for the named export.

**Step 3 — Minimal implementation.** Add to `src/firebase/batches.ts`:

```typescript
import { updateDoc } from 'firebase/firestore';

/** Advances a batch through its lifecycle: 'sending' | 'sent'. */
export async function setBatchStatus(
  db: Firestore,
  uid: string,
  batchId: string,
  status: Extract<Batch['status'], 'sending' | 'sent'>,
): Promise<void> {
  await updateDoc(doc(db, `teachers/${uid}/batches/${batchId}`), { status });
}
```

(Merge `updateDoc` into the existing `firebase/firestore` import line: `import { collection, doc, setDoc, updateDoc, type Firestore } from 'firebase/firestore';`.)

**Step 4 — Run, expect PASS:**

```
npx vitest run src/firebase/batches.test.ts
```

Expected: 2 passed.

**Step 5 — Commit:**

```
git add src/firebase/batches.ts src/firebase/batches.test.ts
git commit -m "feat(batches): setBatchStatus advances batch to sending/sent"
```

---

### Task C22: `saveMessageDraft` (CORRECTED path)

> **Fix:** the earlier draft of this step wrote message drafts to a top-level `messages/{studentId}` collection. That violates Canonical Decision 1. The corrected target is the **subcollection** `teachers/{uid}/batches/{batchId}/messages/{studentId}`, keyed by `studentId` (one in-progress draft per student per batch — the "save my work" record). Full code below; do not reuse the old top-level version.

**Step 1 — Failing test.** Create `src/firebase/messages.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getDoc, doc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { MessageDraft } from '../types';
import { saveMessageDraft } from './messages';

let testEnv: RulesTestEnvironment;
const UID = 'teacher-1';
const BATCH_ID = 'batch-abc';

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'feedback-messages-test',
    firestore: { host: '127.0.0.1', port: 8080 },
  });
  await testEnv.clearFirestore();
});

function db(): Firestore {
  return testEnv.authenticatedContext(UID).firestore() as unknown as Firestore;
}

const draft: MessageDraft = {
  studentId: 'stu-7',
  name: 'Carlos',
  usedEntries: ['entry-1', 'entry-2'],
  slotValues: { name: 'Carlos', semester: 'Spring', highlight: 'your lab writeups' },
  finalText: 'Hi Carlos, great work this Spring on your lab writeups...',
  status: 'draft',
};

describe('saveMessageDraft', () => {
  it('writes to teachers/{uid}/batches/{batchId}/messages/{studentId} keyed by studentId', async () => {
    const database = db();
    await saveMessageDraft(database, UID, BATCH_ID, draft);

    const snap = await getDoc(
      doc(database, `teachers/${UID}/batches/${BATCH_ID}/messages/${draft.studentId}`),
    );
    expect(snap.exists()).toBe(true);
    expect(snap.data()).toEqual(draft);
  });

  it('does NOT write to any top-level messages collection (old path is gone)', async () => {
    const database = db();
    await saveMessageDraft(database, UID, BATCH_ID, draft);

    const stale = await getDoc(doc(database, `messages/${draft.studentId}`));
    expect(stale.exists()).toBe(false);
  });

  it('upserts in place — re-saving the same studentId overwrites, not duplicates', async () => {
    const database = db();
    await saveMessageDraft(database, UID, BATCH_ID, draft);
    await saveMessageDraft(database, UID, BATCH_ID, {
      ...draft,
      finalText: 'edited text',
    });

    const snap = await getDoc(
      doc(database, `teachers/${UID}/batches/${BATCH_ID}/messages/${draft.studentId}`),
    );
    expect(snap.data()?.finalText).toBe('edited text');
  });
});
```

**Step 2 — Run, expect FAIL:**

```
npx vitest run src/firebase/messages.test.ts
```

Expected: `Failed to resolve import "./messages"` / `saveMessageDraft is not a function`.

**Step 3 — Minimal implementation.** Create `src/firebase/messages.ts`:

```typescript
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import type { MessageDraft } from '../types';

/**
 * Persists one student's in-progress message draft to
 * teachers/{uid}/batches/{batchId}/messages/{studentId}.
 *
 * Keyed by draft.studentId so each student has exactly one record per batch:
 * this same doc is the "save my work" draft, the thing that gets sent, and the
 * future history entry. setDoc (no merge) makes auto-save idempotent — re-saving
 * the full MessageDraft overwrites in place.
 *
 * `db` is injected for testability (emulator in tests, app db in prod).
 */
export async function saveMessageDraft(
  db: Firestore,
  uid: string,
  batchId: string,
  draft: MessageDraft,
): Promise<void> {
  const ref = doc(
    db,
    `teachers/${uid}/batches/${batchId}/messages/${draft.studentId}`,
  );
  await setDoc(ref, draft);
}
```

**Step 4 — Run, expect PASS:**

```
npx vitest run src/firebase/messages.test.ts
```

Expected: 3 passed.

**Step 5 — Commit:**

```
git add src/firebase/messages.ts src/firebase/messages.test.ts
git commit -m "fix(messages): saveMessageDraft writes under teachers/{uid}/batches/{batchId}/messages (was top-level)"
```

---

### Task C23: `useDebouncedSave` hook wired to `saveMessageDraft`

> **Integration note / fix:** the old `useDebouncedSave` carried a vestigial unused `_value` parameter and never reached a real persistence call. Corrected contract: the hook is constructed with a **real `batchId`** (the one returned by `createBatch` in Task 4.6) plus the injected `db`/`uid`, and returns a single debounced function that **accepts a `MessageDraft` and persists it** via `saveMessageDraft` (Task 4.8). No `_value`. The Compose screen calls this on every edit (Spec Build Step 4 auto-save; Step 5 send reads the resulting docs).

**Step 1 — Failing test.** Create `src/compose/useDebouncedSave.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Firestore } from 'firebase/firestore';
import type { MessageDraft } from '../types';

// Mock the data layer so this is a pure hook/wiring test (no emulator).
const saveMessageDraft = vi.fn().mockResolvedValue(undefined);
vi.mock('../firebase/messages', () => ({ saveMessageDraft }));

import { useDebouncedSave } from './useDebouncedSave';

const fakeDb = {} as Firestore;
const UID = 'teacher-1';
const BATCH_ID = 'batch-abc';

const draftFor = (studentId: string, finalText: string): MessageDraft => ({
  studentId,
  name: 'Carlos',
  usedEntries: [],
  slotValues: { name: 'Carlos', semester: 'Spring' },
  finalText,
  status: 'draft',
});

beforeEach(() => {
  vi.useFakeTimers();
  saveMessageDraft.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedSave', () => {
  it('debounces and calls saveMessageDraft with db, uid, batchId, and the MessageDraft', () => {
    const { result } = renderHook(() =>
      useDebouncedSave(fakeDb, UID, BATCH_ID, 300),
    );

    act(() => {
      result.current(draftFor('stu-7', 'a'));
      result.current(draftFor('stu-7', 'ab'));
      result.current(draftFor('stu-7', 'abc'));
    });

    // Not yet — still within the debounce window.
    expect(saveMessageDraft).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Exactly once, with only the latest draft.
    expect(saveMessageDraft).toHaveBeenCalledTimes(1);
    expect(saveMessageDraft).toHaveBeenCalledWith(
      fakeDb,
      UID,
      BATCH_ID,
      draftFor('stu-7', 'abc'),
    );
  });

  it('uses the real batchId it was constructed with (no vestigial _value param)', () => {
    const { result } = renderHook(() =>
      useDebouncedSave(fakeDb, UID, 'batch-xyz', 300),
    );

    act(() => {
      result.current(draftFor('stu-9', 'hello'));
      vi.advanceTimersByTime(300);
    });

    expect(saveMessageDraft).toHaveBeenCalledWith(
      fakeDb,
      UID,
      'batch-xyz',
      draftFor('stu-9', 'hello'),
    );
    // The debounced fn takes exactly one arg: the MessageDraft.
    expect(result.current.length).toBe(1);
  });
});
```

**Step 2 — Run, expect FAIL:**

```
npx vitest run src/compose/useDebouncedSave.test.ts
```

Expected: `Failed to resolve import "./useDebouncedSave"` / `useDebouncedSave is not a function`.

**Step 3 — Minimal implementation.** Create `src/compose/useDebouncedSave.ts`:

```typescript
import { useCallback, useEffect, useRef } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { MessageDraft } from '../types';
import { saveMessageDraft } from '../firebase/messages';

/** A debounced saver: call it with a MessageDraft, it persists after `delayMs` idle. */
export type DebouncedSave = (draft: MessageDraft) => void;

/**
 * Returns a debounced function that persists a MessageDraft to the given batch
 * via saveMessageDraft. Wires Compose auto-save to a REAL batchId (from createBatch).
 *
 * No vestigial `_value` param — the debounced fn accepts exactly one argument,
 * the MessageDraft to persist.
 */
export function useDebouncedSave(
  db: Firestore,
  uid: string,
  batchId: string,
  delayMs = 800,
): DebouncedSave {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<MessageDraft | null>(null);

  // Cancel any in-flight timer on unmount.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return useCallback(
    (draft: MessageDraft) => {
      pending.current = draft;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const latest = pending.current;
        if (latest) {
          void saveMessageDraft(db, uid, batchId, latest);
        }
      }, delayMs);
    },
    [db, uid, batchId, delayMs],
  );
}
```

**Step 4 — Run, expect PASS:**

```
npx vitest run src/compose/useDebouncedSave.test.ts
```

Expected: 2 passed.

**Step 5 — Commit:**

```
git add src/compose/useDebouncedSave.ts src/compose/useDebouncedSave.test.ts
git commit -m "feat(compose): useDebouncedSave persists MessageDraft to a real batchId; drop vestigial _value param"
```

---

**Wiring note for the Compose screen (Build Step 4 / consumed by Step 5):** the Compose container calls `createBatch(db, uid, { classId, sharedHeader })` once when a class send is started, holds the returned `batchId` in state, and constructs `const save = useDebouncedSave(db, uid, batchId)`. Every roster/builder edit composes the current `MessageDraft` (studentId, name snapshot, usedEntries, slotValues, finalText, status:`'draft'`) and calls `save(draft)`. Review & send (Build Step 5) then calls `setBatchStatus(db, uid, batchId, 'sending')` before transmitting and `setBatchStatus(db, uid, batchId, 'sent')` on completion, reading the per-student docs written by `saveMessageDraft`. All four functions take `db` as their first parameter (Canonical Decision 3) and operate exclusively on the `teachers/{uid}/…` paths (Canonical Decision 1); types are imported from `src/types.ts` (Canonical Decision 2). These tasks slot in after the existing Compose-panel tasks in Build Step 4 and before the send-machine tasks in Build Step 5.

**Files produced by this cluster (all absolute):**
- `/Users/shiebenaderet/Documents/GitHub/feedback/src/firebase/batches.ts` (+ `batches.test.ts`) — `createBatch`, `setBatchStatus`
- `/Users/shiebenaderet/Documents/GitHub/feedback/src/firebase/messages.ts` (+ `messages.test.ts`) — corrected `saveMessageDraft`
- `/Users/shiebenaderet/Documents/GitHub/feedback/src/compose/useDebouncedSave.ts` (+ `useDebouncedSave.test.ts`) — debounce wiring

**Dependencies these tasks assume already exist:** `src/types.ts` (Canonical Decision 2 — `Batch`, `MessageDraft`), `src/firebase/config.ts` exporting `{ db }` (Decision 3, for the production call site only — tests inject an emulator `Firestore`), and the Foundation `firestore.rules` (Decision 4) whose `teachers/{ownerUid}/{document=**}` rule already permits these subcollection writes, so no rules change is needed here.

### Task C24: `useComposeMessage` hook (selected entries + slot values + live finalText)

State that holds the current student's selected bank entries (`usedEntries`), the fill-slot
values (`slotValues`), recomputes `finalText` via `assembleMessage` on every change, and
exposes `addEntry`, `removeEntry`, and `setSlotValue`.

**Step 1 — Write the failing test.**

`src/compose/useComposeMessage.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useComposeMessage } from './useComposeMessage';
import type { BankEntry, Student, ClassMeta } from '../types';

const student: Student = { id: 's1', name: 'Carlos', email: 'carlos@example.com' };
const classMeta: ClassMeta = { id: 'c1', name: 'Period 3 Biology', semester: 'spring' };

const growthEntry: BankEntry = {
  id: 'e1',
  templateText: '{name} showed real growth this {semester}, especially when {moment}.',
  slots: [
    { key: 'name', kind: 'auto' },
    { key: 'semester', kind: 'auto' },
    { key: 'moment', kind: 'fill', hint: 'a specific moment' },
  ],
  tags: { type: 'growth' },
};

const successEntry: BankEntry = {
  id: 'e2',
  templateText: 'One thing to keep pushing is {area}.',
  slots: [{ key: 'area', kind: 'fill', hint: 'an area' }],
  tags: { type: 'success' },
};

const allEntries = [growthEntry, successEntry];

describe('useComposeMessage', () => {
  it('starts with no entries, empty slotValues, and empty finalText', () => {
    const { result } = renderHook(() =>
      useComposeMessage({ student, classMeta, allEntries }),
    );
    expect(result.current.usedEntries).toEqual([]);
    expect(result.current.slotValues).toEqual({});
    expect(result.current.finalText).toBe('');
  });

  it('addEntry adds the entry id and auto-fills name/semester in finalText', () => {
    const { result } = renderHook(() =>
      useComposeMessage({ student, classMeta, allEntries }),
    );
    act(() => result.current.addEntry('e1'));
    expect(result.current.usedEntries).toEqual(['e1']);
    // auto slots resolved; fill slot still blank
    expect(result.current.finalText).toBe(
      'Carlos showed real growth this spring, especially when .',
    );
  });

  it('addEntry is idempotent (no duplicate ids)', () => {
    const { result } = renderHook(() =>
      useComposeMessage({ student, classMeta, allEntries }),
    );
    act(() => result.current.addEntry('e1'));
    act(() => result.current.addEntry('e1'));
    expect(result.current.usedEntries).toEqual(['e1']);
  });

  it('setSlotValue updates finalText live', () => {
    const { result } = renderHook(() =>
      useComposeMessage({ student, classMeta, allEntries }),
    );
    act(() => result.current.addEntry('e1'));
    act(() => result.current.setSlotValue('moment', 'he redesigned the experiment'));
    expect(result.current.finalText).toBe(
      'Carlos showed real growth this spring, especially when he redesigned the experiment.',
    );
  });

  it('removeEntry drops the entry from finalText', () => {
    const { result } = renderHook(() =>
      useComposeMessage({ student, classMeta, allEntries }),
    );
    act(() => result.current.addEntry('e1'));
    act(() => result.current.addEntry('e2'));
    act(() => result.current.setSlotValue('moment', 'X'));
    act(() => result.current.setSlotValue('area', 'speaking up'));
    expect(result.current.finalText).toBe(
      'Carlos showed real growth this spring, especially when X.\n\n' +
        'One thing to keep pushing is speaking up.',
    );
    act(() => result.current.removeEntry('e1'));
    expect(result.current.usedEntries).toEqual(['e2']);
    expect(result.current.finalText).toBe('One thing to keep pushing is speaking up.');
  });
});
```

**Step 2 — Run, expect FAIL.**

```bash
npx vitest run src/compose/useComposeMessage.test.ts
```

Expected: FAIL — `Cannot find module './useComposeMessage'`.

**Step 3 — Minimal implementation.**

`src/compose/useComposeMessage.ts`:

```ts
import { useState, useMemo, useCallback } from 'react';
import type { BankEntry, Student, ClassMeta } from '../types';
import { assembleMessage } from './assembleMessage';

export interface UseComposeMessageArgs {
  student: Student;
  classMeta: ClassMeta;
  allEntries: BankEntry[];
}

export interface UseComposeMessageResult {
  usedEntries: string[];
  slotValues: Record<string, string>;
  finalText: string;
  selectedEntries: BankEntry[];
  addEntry: (entryId: string) => void;
  removeEntry: (entryId: string) => void;
  setSlotValue: (key: string, val: string) => void;
}

export function useComposeMessage({
  student,
  classMeta,
  allEntries,
}: UseComposeMessageArgs): UseComposeMessageResult {
  const [usedEntries, setUsedEntries] = useState<string[]>([]);
  const [slotValues, setSlotValues] = useState<Record<string, string>>({});

  const byId = useMemo(() => {
    const m = new Map<string, BankEntry>();
    for (const e of allEntries) m.set(e.id, e);
    return m;
  }, [allEntries]);

  const selectedEntries = useMemo(
    () => usedEntries.map((id) => byId.get(id)).filter((e): e is BankEntry => !!e),
    [usedEntries, byId],
  );

  const finalText = useMemo(
    () => assembleMessage(selectedEntries, student, classMeta, slotValues),
    [selectedEntries, student, classMeta, slotValues],
  );

  const addEntry = useCallback((entryId: string) => {
    setUsedEntries((prev) => (prev.includes(entryId) ? prev : [...prev, entryId]));
  }, []);

  const removeEntry = useCallback((entryId: string) => {
    setUsedEntries((prev) => prev.filter((id) => id !== entryId));
  }, []);

  const setSlotValue = useCallback((key: string, val: string) => {
    setSlotValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  return {
    usedEntries,
    slotValues,
    finalText,
    selectedEntries,
    addEntry,
    removeEntry,
    setSlotValue,
  };
}
```

**Step 4 — Run, expect PASS.**

```bash
npx vitest run src/compose/useComposeMessage.test.ts
```

Expected: PASS (5 tests).

**Step 5 — Commit.**

```bash
git add src/compose/useComposeMessage.ts src/compose/useComposeMessage.test.ts
git commit -m "Add useComposeMessage hook: selected entries, slot values, live finalText

Replaces the Task 307 stub that hardcoded usedEntries:[] and slotValues:{}.
Holds the current student's selected bank entries and fill-slot answers, and
recomputes finalText via assembleMessage on every change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C25: Fill-slot input UI (one labeled input per unfilled FILL slot)

For every `fill`-kind slot across the selected entries, render a labeled input bound to
`setSlotValue`. Smoke test: typing updates `finalText`; removing an entry drops its slots.

**Step 1 — Write the failing test.**

`src/compose/FillSlotInputs.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useComposeMessage } from './useComposeMessage';
import { FillSlotInputs } from './FillSlotInputs';
import type { BankEntry, Student, ClassMeta } from '../types';

const student: Student = { id: 's1', name: 'Carlos', email: 'carlos@example.com' };
const classMeta: ClassMeta = { id: 'c1', name: 'Period 3 Biology', semester: 'spring' };

const growthEntry: BankEntry = {
  id: 'e1',
  templateText: '{name} grew this {semester} when {moment}.',
  slots: [
    { key: 'name', kind: 'auto' },
    { key: 'semester', kind: 'auto' },
    { key: 'moment', kind: 'fill', hint: 'a specific moment' },
  ],
  tags: { type: 'growth' },
};

const areaEntry: BankEntry = {
  id: 'e2',
  templateText: 'Keep pushing on {area}.',
  slots: [{ key: 'area', kind: 'fill', hint: 'an area' }],
  tags: { type: 'success' },
};

const allEntries = [growthEntry, areaEntry];

// Test harness wiring the hook to the UI and showing finalText.
function Harness() {
  const compose = useComposeMessage({ student, classMeta, allEntries });
  return (
    <div>
      <button onClick={() => compose.addEntry('e1')}>add-e1</button>
      <button onClick={() => compose.addEntry('e2')}>add-e2</button>
      <button onClick={() => compose.removeEntry('e1')}>remove-e1</button>
      <FillSlotInputs
        selectedEntries={compose.selectedEntries}
        slotValues={compose.slotValues}
        setSlotValue={compose.setSlotValue}
      />
      <pre data-testid="final">{compose.finalText}</pre>
    </div>
  );
}

describe('FillSlotInputs', () => {
  it('renders a labeled input only for unfilled fill slots, not auto slots', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('add-e1'));
    // auto slots (name/semester) get NO input
    expect(screen.queryByLabelText('name')).toBeNull();
    expect(screen.queryByLabelText('semester')).toBeNull();
    // fill slot gets a labeled input
    expect(screen.getByLabelText('moment')).toBeInstanceOf(HTMLInputElement);
  });

  it('typing in a fill-slot input updates finalText', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('add-e1'));
    fireEvent.change(screen.getByLabelText('moment'), {
      target: { value: 'he redesigned the experiment' },
    });
    expect(screen.getByTestId('final').textContent).toBe(
      'Carlos grew this spring when he redesigned the experiment.',
    );
  });

  it('removing an entry drops its fill-slot input', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('add-e1'));
    fireEvent.click(screen.getByText('add-e2'));
    expect(screen.getByLabelText('moment')).toBeTruthy();
    expect(screen.getByLabelText('area')).toBeTruthy();
    fireEvent.click(screen.getByText('remove-e1'));
    expect(screen.queryByLabelText('moment')).toBeNull();
    expect(screen.getByLabelText('area')).toBeTruthy();
  });

  it('uses the slot hint as placeholder when present', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('add-e1'));
    expect(screen.getByLabelText('moment')).toHaveProperty(
      'placeholder',
      'a specific moment',
    );
  });
});
```

**Step 2 — Run, expect FAIL.**

```bash
npx vitest run src/compose/FillSlotInputs.test.tsx
```

Expected: FAIL — `Cannot find module './FillSlotInputs'`.

**Step 3 — Minimal implementation.**

`src/compose/FillSlotInputs.tsx`:

```tsx
import type { BankEntry, Slot } from '../types';

export interface FillSlotInputsProps {
  selectedEntries: BankEntry[];
  slotValues: Record<string, string>;
  setSlotValue: (key: string, val: string) => void;
}

// Collect each distinct FILL slot across the selected entries, first occurrence wins.
function collectFillSlots(entries: BankEntry[]): Slot[] {
  const seen = new Set<string>();
  const out: Slot[] = [];
  for (const entry of entries) {
    for (const slot of entry.slots) {
      if (slot.kind === 'fill' && !seen.has(slot.key)) {
        seen.add(slot.key);
        out.push(slot);
      }
    }
  }
  return out;
}

export function FillSlotInputs({
  selectedEntries,
  slotValues,
  setSlotValue,
}: FillSlotInputsProps) {
  const fillSlots = collectFillSlots(selectedEntries);
  if (fillSlots.length === 0) return null;

  return (
    <div className="fill-slot-inputs">
      {fillSlots.map((slot) => (
        <label key={slot.key} style={{ display: 'block' }}>
          <span>{slot.key}</span>
          <input
            aria-label={slot.key}
            placeholder={slot.hint ?? ''}
            value={slotValues[slot.key] ?? ''}
            onChange={(e) => setSlotValue(slot.key, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
```

> Note: `toBeInstanceOf`/`toHaveProperty` are vitest built-ins; the DOM matchers come from
> `@testing-library/jest-dom` already registered in the project's `vitest.setup.ts` (Step 1
> Foundation). The label wraps the input so `getByLabelText('moment')` resolves via
> `aria-label`.

**Step 4 — Run, expect PASS.**

```bash
npx vitest run src/compose/FillSlotInputs.test.tsx
```

Expected: PASS (4 tests).

**Step 5 — Commit.**

```bash
git add src/compose/FillSlotInputs.tsx src/compose/FillSlotInputs.test.tsx
git commit -m "Add fill-slot input UI bound to setSlotValue

Renders one labeled input per unfilled FILL slot across the selected entries;
auto slots (name/semester) get no input. Typing updates finalText live and
removing an entry drops its slots.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C26: Corrected bank-picker filter (type options derived from actual entries)

The old Task 307 hardcoded the type-filter chips to `['success','growth']`. Derive the type
options from the actual entries' `tags.type`, and filter the visible entries by the selected
type.

**Step 1 — Write the failing test.**

`src/compose/bankFilter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveTypeOptions, filterEntriesByType } from './bankFilter';
import type { BankEntry } from '../types';

const entries: BankEntry[] = [
  { id: 'e1', templateText: '{name} a', slots: [{ key: 'name', kind: 'auto' }], tags: { type: 'growth' } },
  { id: 'e2', templateText: 'b', slots: [], tags: { type: 'behavior' } },
  { id: 'e3', templateText: 'c', slots: [], tags: { type: 'growth' } },
  { id: 'e4', templateText: 'd', slots: [], tags: {} }, // no type
];

describe('deriveTypeOptions', () => {
  it('returns the distinct, sorted, defined types present in the entries', () => {
    // NOT the hardcoded ['success','growth']: 'success' is absent, 'behavior' is present.
    expect(deriveTypeOptions(entries)).toEqual(['behavior', 'growth']);
  });

  it('returns an empty list when no entries have a type', () => {
    expect(deriveTypeOptions([entries[3]])).toEqual([]);
  });
});

describe('filterEntriesByType', () => {
  it('returns all entries when type is null (no filter)', () => {
    expect(filterEntriesByType(entries, null).map((e) => e.id)).toEqual([
      'e1', 'e2', 'e3', 'e4',
    ]);
  });

  it('returns only entries matching the selected type', () => {
    expect(filterEntriesByType(entries, 'growth').map((e) => e.id)).toEqual(['e1', 'e3']);
  });
});
```

**Step 2 — Run, expect FAIL.**

```bash
npx vitest run src/compose/bankFilter.test.ts
```

Expected: FAIL — `Cannot find module './bankFilter'`.

**Step 3 — Minimal implementation.**

`src/compose/bankFilter.ts`:

```ts
import type { BankEntry } from '../types';

/** Distinct, sorted, defined `tags.type` values present in the given entries. */
export function deriveTypeOptions(entries: BankEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) {
    const t = e.tags.type;
    if (t) set.add(t);
  }
  return [...set].sort();
}

/** Filter entries by type; `null` means no filter (return all). */
export function filterEntriesByType(
  entries: BankEntry[],
  type: string | null,
): BankEntry[] {
  if (type === null) return entries;
  return entries.filter((e) => e.tags.type === type);
}
```

**Step 4 — Run, expect PASS.**

```bash
npx vitest run src/compose/bankFilter.test.ts
```

Expected: PASS (4 tests).

**Step 5 — Commit.**

```bash
git add src/compose/bankFilter.ts src/compose/bankFilter.test.ts
git commit -m "Derive bank-picker type filter from actual entries

Replaces the Task 307 hardcoded ['success','growth'] chips with type options
computed from the entries' tags.type, plus a filter helper.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C27: Wire ComposeScreen: hook + fill-slot UI + derived filter + debounced auto-save

Replace the Task 307 stub in `ComposeScreen` so it (1) uses `useComposeMessage`, (2) renders
the bank picker with the derived filter and `FillSlotInputs`, and (3) wires `onAutoSave` to a
debounced `saveMessageDraft` using a real `batchId` prop. The MessageDraft persisted now
carries real `usedEntries`/`slotValues`/`finalText` instead of empty stubs.

**Step 1 — Write the failing test.**

`src/compose/ComposeScreen.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComposeScreen } from './ComposeScreen';
import type { BankEntry, Student, ClassMeta, MessageDraft } from '../types';

const student: Student = { id: 's1', name: 'Carlos', email: 'carlos@example.com' };
const classMeta: ClassMeta = { id: 'c1', name: 'Period 3 Biology', semester: 'spring' };

const entries: BankEntry[] = [
  {
    id: 'e1',
    templateText: '{name} grew this {semester} when {moment}.',
    slots: [
      { key: 'name', kind: 'auto' },
      { key: 'semester', kind: 'auto' },
      { key: 'moment', kind: 'fill', hint: 'a specific moment' },
    ],
    tags: { type: 'growth' },
  },
  { id: 'e2', templateText: 'Nice collaboration.', slots: [], tags: { type: 'behavior' } },
];

describe('ComposeScreen', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders type-filter chips derived from entries (behavior, growth — not success)', () => {
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'growth' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'behavior' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'success' })).toBeNull();
  });

  it('adding an entry + filling a slot debounce-saves a real MessageDraft with batchId', async () => {
    const onAutoSave = vi.fn<(batchId: string, draft: MessageDraft) => void>();
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={onAutoSave}
      />,
    );
    // add entry e1 from the bank picker
    fireEvent.click(screen.getByRole('button', { name: /add Lab.*|add e1|\+ e1/i }) ??
      screen.getByTestId('add-e1'));
    // fill its slot
    fireEvent.change(screen.getByLabelText('moment'), {
      target: { value: 'he redesigned the experiment' },
    });
    // advance past the 800ms debounce
    vi.advanceTimersByTime(800);
    await waitFor(() => expect(onAutoSave).toHaveBeenCalled());
    const [batchId, draft] = onAutoSave.mock.calls.at(-1)!;
    expect(batchId).toBe('b1');
    expect(draft).toMatchObject<Partial<MessageDraft>>({
      studentId: 's1',
      name: 'Carlos',
      usedEntries: ['e1'],
      slotValues: { moment: 'he redesigned the experiment' },
      finalText: 'Carlos grew this spring when he redesigned the experiment.',
      status: 'draft',
    });
  });

  it('does NOT save the empty stub before any edit (debounce + no-op guard)', () => {
    const onAutoSave = vi.fn();
    render(
      <ComposeScreen
        batchId="b1"
        student={student}
        classMeta={classMeta}
        entries={entries}
        onAutoSave={onAutoSave}
      />,
    );
    vi.advanceTimersByTime(800);
    expect(onAutoSave).not.toHaveBeenCalled();
  });
});
```

**Step 2 — Run, expect FAIL.**

```bash
npx vitest run src/compose/ComposeScreen.test.tsx
```

Expected: FAIL — `Cannot find module './ComposeScreen'` (or, if the Task 307 stub still
exists, FAIL because it renders hardcoded `success`/`growth` chips and calls `onAutoSave`
with `usedEntries: []`, `slotValues: {}`).

**Step 3 — Minimal implementation.**

`src/compose/ComposeScreen.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import type { BankEntry, Student, ClassMeta, MessageDraft } from '../types';
import { useComposeMessage } from './useComposeMessage';
import { FillSlotInputs } from './FillSlotInputs';
import { deriveTypeOptions, filterEntriesByType } from './bankFilter';
import { useState } from 'react';

export interface ComposeScreenProps {
  batchId: string;
  student: Student;
  classMeta: ClassMeta;
  entries: BankEntry[];
  /** Debounced persistence sink — caller wires this to saveMessageDraft. */
  onAutoSave: (batchId: string, draft: MessageDraft) => void;
  debounceMs?: number;
}

export function ComposeScreen({
  batchId,
  student,
  classMeta,
  entries,
  onAutoSave,
  debounceMs = 800,
}: ComposeScreenProps) {
  const compose = useComposeMessage({ student, classMeta, allEntries: entries });
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const typeOptions = deriveTypeOptions(entries);
  const visibleEntries = filterEntriesByType(entries, typeFilter);

  // Debounced auto-save: fire only after the user has touched the message
  // (skip the initial empty stub so we never persist usedEntries:[]/slotValues:{}).
  const touchedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (compose.usedEntries.length > 0 || Object.keys(compose.slotValues).length > 0) {
    touchedRef.current = true;
  }

  useEffect(() => {
    if (!touchedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const draft: MessageDraft = {
        studentId: student.id,
        name: student.name,
        usedEntries: compose.usedEntries,
        slotValues: compose.slotValues,
        finalText: compose.finalText,
        status: 'draft',
      };
      onAutoSave(batchId, draft);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    batchId,
    student.id,
    student.name,
    compose.usedEntries,
    compose.slotValues,
    compose.finalText,
    onAutoSave,
    debounceMs,
  ]);

  return (
    <div className="compose-screen" style={{ display: 'flex', gap: 14 }}>
      {/* MIDDLE: message builder */}
      <div className="compose-builder" style={{ flex: 1 }}>
        <div className="label">{student.name}'s message</div>
        <pre data-testid="final-text">{compose.finalText}</pre>
        <FillSlotInputs
          selectedEntries={compose.selectedEntries}
          slotValues={compose.slotValues}
          setSlotValue={compose.setSlotValue}
        />
      </div>

      {/* RIGHT: bank picker */}
      <div className="compose-bank" style={{ flex: '0 0 230px' }}>
        <div className="label">Bank · filter</div>
        <div className="bank-filter-chips">
          <button
            aria-pressed={typeFilter === null}
            onClick={() => setTypeFilter(null)}
          >
            all
          </button>
          {typeOptions.map((t) => (
            <button
              key={t}
              aria-pressed={typeFilter === t}
              onClick={() => setTypeFilter((cur) => (cur === t ? null : t))}
            >
              {t}
            </button>
          ))}
        </div>
        <ul className="bank-entries">
          {visibleEntries.map((e) => (
            <li key={e.id}>
              <button
                data-testid={`add-${e.id}`}
                onClick={() => compose.addEntry(e.id)}
                disabled={compose.usedEntries.includes(e.id)}
              >
                + {e.templateText.slice(0, 24)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

> The caller (Compose route, built in the app shell) wires `onAutoSave` to the real
> persistence layer:
>
> ```tsx
> import { db } from '../firebase/config';
> import { saveMessageDraft } from '../data/saveMessageDraft';
> // uid from the auth context (signed-in teacher)
> <ComposeScreen
>   batchId={batch.id}
>   student={student}
>   classMeta={classMeta}
>   entries={bankEntries}
>   onAutoSave={(batchId, draft) => saveMessageDraft(db, uid, batchId, draft)}
> />
> ```

**Step 4 — Run, expect PASS.**

```bash
npx vitest run src/compose/ComposeScreen.test.tsx
```

Expected: PASS (3 tests). The first add-button query in the test resolves via the
`data-testid="add-e1"` fallback.

**Step 5 — Commit.**

```bash
git add src/compose/ComposeScreen.tsx src/compose/ComposeScreen.test.tsx
git commit -m "Wire ComposeScreen to real compose state, derived filter, and debounced auto-save

Replaces the Task 307 stub (hardcoded success/growth chips, usedEntries:[],
slotValues:{}). ComposeScreen now uses useComposeMessage, renders FillSlotInputs
and a type filter derived from the actual entries, and debounce-saves a real
MessageDraft via onAutoSave(batchId, draft) with a real batchId prop.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Verification (whole cluster)

```bash
npx vitest run src/compose/useComposeMessage.test.ts \
  src/compose/FillSlotInputs.test.tsx \
  src/compose/bankFilter.test.ts \
  src/compose/ComposeScreen.test.tsx
```

Expected: all four suites PASS. The persisted `MessageDraft` now carries real
`usedEntries`, `slotValues`, and `finalText` (no empty stub), the fill-slot inputs drive
`finalText` live and disappear when an entry is removed, and the bank-picker type filter is
derived from the entries (`behavior`, `growth`) rather than the hardcoded `success`/`growth`.
```

Key file paths produced by this plan (all absolute, under `/Users/shiebenaderet/Documents/GitHub/feedback/`):
- `src/compose/useComposeMessage.ts` + `.test.ts` (Task 4a)
- `src/compose/FillSlotInputs.tsx` + `.test.tsx` (Task 4b)
- `src/compose/bankFilter.ts` + `.test.ts` (Task 4c)
- `src/compose/ComposeScreen.tsx` + `.test.tsx` (Task 4d)

All tasks import canonical types from `src/types.ts`, reference (without re-implementing) `assembleMessage`/`fillSlots` from `src/compose/assembleMessage.ts` and `saveMessageDraft` from `src/data/saveMessageDraft.ts` (both from Build Step 4), and respect the Firestore path `teachers/{uid}/batches/{batchId}/messages/{studentId}` via the `batchId` prop passed through `onAutoSave`.

## Step S — Send

### Task S1: Grammar check pure function — double-word and homophone flags

**Files:**
- Create: `src/grammar/grammarCheck.ts`
- Test: `src/grammar/grammarCheck.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// src/grammar/grammarCheck.test.ts
import { describe, it, expect } from 'vitest';
import { grammarCheck, type GrammarIssue } from './grammarCheck';

describe('grammarCheck — double words', () => {
  it('flags a repeated word', () => {
    const issues = grammarCheck('You did did a great job.');
    expect(issues).toContainEqual<GrammarIssue>({
      kind: 'double-word',
      message: 'Repeated word: "did"',
      excerpt: 'did did',
    });
  });

  it('ignores case but still flags repeats', () => {
    const issues = grammarCheck('The the answer is correct.');
    expect(issues.some((i) => i.kind === 'double-word')).toBe(true);
  });

  it('does not flag non-repeats', () => {
    const issues = grammarCheck('You did a great job today.');
    expect(issues.filter((i) => i.kind === 'double-word')).toHaveLength(0);
  });
});

describe('grammarCheck — homophones', () => {
  it('flags possible their/there/they\'re confusion', () => {
    const issues = grammarCheck('Their going to enjoy this.');
    expect(issues.some((i) => i.kind === 'homophone')).toBe(true);
  });

  it('does not flag clean text', () => {
    const issues = grammarCheck('She improved every week.');
    expect(issues).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/grammar/grammarCheck.test.ts`
Expected: FAIL because `src/grammar/grammarCheck.ts` does not exist yet (import error).

- [ ] **Step 3: Write minimal implementation**
```ts
// src/grammar/grammarCheck.ts

export type GrammarIssueKind =
  | 'double-word'
  | 'homophone'
  | 'passive-voice'
  | 'run-on';

export interface GrammarIssue {
  kind: GrammarIssueKind;
  message: string;
  excerpt: string;
}

const WORD_RE = /\b[\w']+\b/g;

function findDoubleWords(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];
  const words = text.match(WORD_RE) ?? [];
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const cur = words[i];
    if (prev.toLowerCase() === cur.toLowerCase() && /^[a-z']+$/i.test(cur)) {
      issues.push({
        kind: 'double-word',
        message: `Repeated word: "${cur.toLowerCase()}"`,
        excerpt: `${prev} ${cur}`,
      });
    }
  }
  return issues;
}

// Heuristic: flag a homophone word only when it appears to be used
// in a context that usually wants a different spelling.
const HOMOPHONE_RULES: Array<{ word: string; nextIs: RegExp; note: string }> = [
  // "their going" -> probably "they're going"
  { word: 'their', nextIs: /^(going|here|not|coming|the|a)$/i, note: 'their/there/they\'re' },
  // "there going" -> probably "they're going"
  { word: 'there', nextIs: /^(going|coming|not)$/i, note: 'their/there/they\'re' },
  // "your" before a verb-ish word -> probably "you're"
  { word: 'your', nextIs: /^(going|doing|the|a|not)$/i, note: 'your/you\'re' },
];

function findHomophones(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];
  const words = text.match(WORD_RE) ?? [];
  for (let i = 0; i < words.length - 1; i++) {
    const cur = words[i].toLowerCase();
    const next = words[i + 1];
    for (const rule of HOMOPHONE_RULES) {
      if (cur === rule.word && rule.nextIs.test(next)) {
        issues.push({
          kind: 'homophone',
          message: `Possible ${rule.note} confusion near "${words[i]} ${next}"`,
          excerpt: `${words[i]} ${next}`,
        });
      }
    }
  }
  return issues;
}

export function grammarCheck(text: string): GrammarIssue[] {
  return [...findDoubleWords(text), ...findHomophones(text)];
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/grammar/grammarCheck.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/grammar/grammarCheck.ts src/grammar/grammarCheck.test.ts && git commit -m "Add grammar check: double-word and homophone heuristics"`

---

### Task S2: Grammar check — passive-voice and run-on heuristics

**Files:**
- Modify: `src/grammar/grammarCheck.ts` (add two detectors, extend `grammarCheck`)
- Test: `src/grammar/grammarCheck.passive.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// src/grammar/grammarCheck.passive.test.ts
import { describe, it, expect } from 'vitest';
import { grammarCheck } from './grammarCheck';

describe('grammarCheck — passive voice heuristic', () => {
  it('flags "was completed by" as passive', () => {
    const issues = grammarCheck('The project was completed by your group.');
    expect(issues.some((i) => i.kind === 'passive-voice')).toBe(true);
  });

  it('flags "is graded" form', () => {
    const issues = grammarCheck('Your essay is graded fairly.');
    expect(issues.some((i) => i.kind === 'passive-voice')).toBe(true);
  });

  it('does not flag active voice', () => {
    const issues = grammarCheck('You completed the project on time.');
    expect(issues.filter((i) => i.kind === 'passive-voice')).toHaveLength(0);
  });
});

describe('grammarCheck — run-on heuristic', () => {
  it('flags a very long comma-heavy sentence with no period', () => {
    const longSentence =
      'You worked hard this year and you improved a lot and you helped others ' +
      'and you stayed focused and you asked good questions and you finished strong ' +
      'and you never gave up and you set a great example for everyone around you here';
    const issues = grammarCheck(longSentence);
    expect(issues.some((i) => i.kind === 'run-on')).toBe(true);
  });

  it('does not flag normal sentences', () => {
    const issues = grammarCheck('You did well. Keep it up next year.');
    expect(issues.filter((i) => i.kind === 'run-on')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/grammar/grammarCheck.passive.test.ts`
Expected: FAIL because no `passive-voice` or `run-on` issues are produced yet.

- [ ] **Step 3: Write minimal implementation**
Add these detectors to `src/grammar/grammarCheck.ts` and include them in the exported function. The `GrammarIssue` shape stays `{ kind, message, excerpt }` with `kind` already including `'passive-voice' | 'run-on'`.
```ts
// Append to src/grammar/grammarCheck.ts

// Passive voice: a "to be" verb followed (within 2 words) by a past participle.
const BE_VERBS = ['is', 'are', 'was', 'were', 'be', 'been', 'being'];
// Crude past-participle test: ends in "ed" or a small irregular set.
const IRREGULAR_PARTICIPLES = new Set([
  'completed', 'given', 'taken', 'written', 'done', 'made', 'seen', 'shown',
]);

function isParticiple(word: string): boolean {
  const w = word.toLowerCase();
  return w.endsWith('ed') || IRREGULAR_PARTICIPLES.has(w);
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

function findPassiveVoice(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];
  for (const sentence of splitSentences(text)) {
    const words = sentence.match(WORD_RE) ?? [];
    for (let i = 0; i < words.length - 1; i++) {
      if (BE_VERBS.includes(words[i].toLowerCase())) {
        // look at the next two words for a participle
        const window = words.slice(i + 1, i + 3);
        const hit = window.find(isParticiple);
        if (hit) {
          issues.push({
            kind: 'passive-voice',
            message: `Possible passive voice near "${words[i]} ${hit}"`,
            excerpt: `${words[i]} ${hit}`,
          });
          break; // one flag per sentence is enough
        }
      }
    }
  }
  return issues;
}

// Run-on: a single sentence over 40 words OR with 3+ coordinating "and/but/so"
// joins and no internal terminal punctuation.
function findRunOns(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];
  for (const sentence of splitSentences(text)) {
    const words = sentence.match(WORD_RE) ?? [];
    const conj = words.filter((w) => /^(and|but|so)$/i.test(w)).length;
    if (words.length > 40 || (words.length > 25 && conj >= 3)) {
      issues.push({
        kind: 'run-on',
        message: `Possible run-on sentence (${words.length} words)`,
        excerpt: sentence.slice(0, 60) + (sentence.length > 60 ? '…' : ''),
      });
    }
  }
  return issues;
}
```
Then update the exported function:
```ts
// Replace the existing grammarCheck export body with:
export function grammarCheck(text: string): GrammarIssue[] {
  return [
    ...findDoubleWords(text),
    ...findHomophones(text),
    ...findPassiveVoice(text),
    ...findRunOns(text),
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/grammar/grammarCheck.passive.test.ts src/grammar/grammarCheck.test.ts`
Expected: PASS (both the new and the original grammar suites stay green)

- [ ] **Step 5: Commit**
`git add src/grammar/grammarCheck.ts src/grammar/grammarCheck.passive.test.ts && git commit -m "Add passive-voice and run-on grammar heuristics"`

---

### Task S3: Batch-send state machine — initial state and per-message marking

**Files:**
- Create: `src/send/batchSendMachine.ts`
- Test: `src/send/batchSendMachine.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// src/send/batchSendMachine.test.ts
import { describe, it, expect } from 'vitest';
import {
  createSendState,
  markSent,
  markFailed,
  type SendState,
} from './batchSendMachine';

// Minimal message shape the machine needs (snapshot of Firestore `messages`):
// { id: string; email: string; finalText: string }
const msgs = [
  { id: 'm1', email: 'a@x.com', finalText: 'Hi A' },
  { id: 'm2', email: 'b@x.com', finalText: 'Hi B' },
  { id: 'm3', email: 'c@x.com', finalText: 'Hi C' },
];

describe('createSendState', () => {
  it('starts every message as pending', () => {
    const state = createSendState(msgs);
    expect(state.statuses).toEqual({ m1: 'pending', m2: 'pending', m3: 'pending' });
    expect(state.phase).toBe('idle');
  });
});

describe('markSent / markFailed', () => {
  it('marks one message sent without touching others', () => {
    let state: SendState = createSendState(msgs);
    state = markSent(state, 'm2');
    expect(state.statuses).toEqual({ m1: 'pending', m2: 'sent', m3: 'pending' });
  });

  it('records a failure reason and leaves others untouched', () => {
    let state: SendState = createSendState(msgs);
    state = markFailed(state, 'm1', 'token expired');
    expect(state.statuses.m1).toBe('failed');
    expect(state.errors.m1).toBe('token expired');
    expect(state.statuses.m2).toBe('pending');
  });

  it('treats marking as immutable (returns a new object)', () => {
    const state = createSendState(msgs);
    const next = markSent(state, 'm1');
    expect(next).not.toBe(state);
    expect(state.statuses.m1).toBe('pending'); // original unchanged
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/send/batchSendMachine.test.ts`
Expected: FAIL because `src/send/batchSendMachine.ts` does not exist yet (import error).

- [ ] **Step 3: Write minimal implementation**
```ts
// src/send/batchSendMachine.ts

export type MessageStatus = 'pending' | 'sending' | 'sent' | 'failed';
export type SendPhase = 'idle' | 'running' | 'done';

// Minimal message snapshot the machine operates on.
export interface SendableMessage {
  id: string;
  email: string;
  finalText: string;
}

export interface SendState {
  order: string[]; // message ids in send order
  statuses: Record<string, MessageStatus>;
  errors: Record<string, string>;
  phase: SendPhase;
}

export function createSendState(messages: SendableMessage[]): SendState {
  const statuses: Record<string, MessageStatus> = {};
  for (const m of messages) statuses[m.id] = 'pending';
  return {
    order: messages.map((m) => m.id),
    statuses,
    errors: {},
    phase: 'idle',
  };
}

export function markSending(state: SendState, id: string): SendState {
  return { ...state, statuses: { ...state.statuses, [id]: 'sending' } };
}

export function markSent(state: SendState, id: string): SendState {
  const errors = { ...state.errors };
  delete errors[id];
  return { ...state, statuses: { ...state.statuses, [id]: 'sent' }, errors };
}

export function markFailed(state: SendState, id: string, reason: string): SendState {
  return {
    ...state,
    statuses: { ...state.statuses, [id]: 'failed' },
    errors: { ...state.errors, [id]: reason },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/send/batchSendMachine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/send/batchSendMachine.ts src/send/batchSendMachine.test.ts && git commit -m "Add batch-send state: pending init and immutable per-message marking"`

---

### Task S4: Batch-send runner — iterate, partial-failure isolation, progress

**Files:**
- Modify: `src/send/batchSendMachine.ts` (add `runSend` + `progressOf` + selectors)
- Test: `src/send/batchSendRunner.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// src/send/batchSendRunner.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  createSendState,
  runSend,
  progressOf,
  failedIds,
  type SendState,
} from './batchSendMachine';

const msgs = [
  { id: 'm1', email: 'a@x.com', finalText: 'Hi A' },
  { id: 'm2', email: 'b@x.com', finalText: 'Hi B' },
  { id: 'm3', email: 'c@x.com', finalText: 'Hi C' },
];

describe('runSend', () => {
  it('sends every message when the sender resolves', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const final = await runSend(createSendState(msgs), msgs, send);
    expect(send).toHaveBeenCalledTimes(3);
    expect(final.statuses).toEqual({ m1: 'sent', m2: 'sent', m3: 'sent' });
    expect(final.phase).toBe('done');
  });

  it('does not halt on a partial failure; others still send', async () => {
    const send = vi.fn(async (m: { id: string }) => {
      if (m.id === 'm2') throw new Error('quota');
    });
    const final = await runSend(createSendState(msgs), msgs, send);
    expect(final.statuses).toEqual({ m1: 'sent', m2: 'failed', m3: 'sent' });
    expect(final.errors.m2).toBe('quota');
    expect(failedIds(final)).toEqual(['m2']);
  });

  it('retry touches only the failed messages', async () => {
    const send = vi.fn(async (m: { id: string }) => {
      if (m.id === 'm2') throw new Error('quota');
    });
    const afterFirst = await runSend(createSendState(msgs), msgs, send);

    // Retry: only the failed message is retried, and now it succeeds.
    send.mockClear();
    const retrySender = vi.fn().mockResolvedValue(undefined);
    const failedMsgs = msgs.filter((m) => failedIds(afterFirst).includes(m.id));
    const afterRetry = await runSend(afterFirst, failedMsgs, retrySender);

    expect(retrySender).toHaveBeenCalledTimes(1);
    expect(retrySender).toHaveBeenCalledWith(failedMsgs[0]);
    expect(afterRetry.statuses).toEqual({ m1: 'sent', m2: 'sent', m3: 'sent' });
    expect(failedIds(afterRetry)).toEqual([]);
  });

  it('progressOf reports sent vs total', () => {
    let state: SendState = createSendState(msgs);
    state = { ...state, statuses: { m1: 'sent', m2: 'failed', m3: 'pending' } };
    expect(progressOf(state)).toEqual({ done: 2, total: 3, sent: 1, failed: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/send/batchSendRunner.test.ts`
Expected: FAIL because `runSend`, `progressOf`, and `failedIds` are not exported yet.

- [ ] **Step 3: Write minimal implementation**
Append to `src/send/batchSendMachine.ts`. The `SendState` shape is `{ order, statuses, errors, phase }` and `SendableMessage` is `{ id, email, finalText }` (both defined earlier in this file); `markSending/markSent/markFailed` already exist.
```ts
// Append to src/send/batchSendMachine.ts

export type GmailSender = (message: SendableMessage) => Promise<void>;

// Runs the given subset of messages through the sender, mutating only those ids.
// Messages NOT in `toSend` keep whatever status they already had (retry isolation).
export async function runSend(
  state: SendState,
  toSend: SendableMessage[],
  sender: GmailSender,
): Promise<SendState> {
  let current: SendState = { ...state, phase: 'running' };
  for (const msg of toSend) {
    current = markSending(current, msg.id);
    try {
      await sender(msg);
      current = markSent(current, msg.id);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      current = markFailed(current, msg.id, reason);
    }
  }
  return { ...current, phase: 'done' };
}

export interface SendProgress {
  done: number;  // sent + failed
  total: number;
  sent: number;
  failed: number;
}

export function progressOf(state: SendState): SendProgress {
  const values = Object.values(state.statuses);
  const sent = values.filter((s) => s === 'sent').length;
  const failed = values.filter((s) => s === 'failed').length;
  return { done: sent + failed, total: values.length, sent, failed };
}

export function failedIds(state: SendState): string[] {
  return state.order.filter((id) => state.statuses[id] === 'failed');
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/send/batchSendRunner.test.ts src/send/batchSendMachine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/send/batchSendMachine.ts src/send/batchSendRunner.test.ts && git commit -m "Add runSend iterator with partial-failure isolation, retry, and progress"`

---

### Task S5: Gmail send adapter — RFC822 builder + base64url encoder

**Files:**
- Create: `src/send/rfc822.ts`
- Test: `src/send/rfc822.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// src/send/rfc822.test.ts
import { describe, it, expect } from 'vitest';
import { buildRfc822, toBase64Url } from './rfc822';

describe('toBase64Url', () => {
  it('encodes to URL-safe base64 with no padding', () => {
    // "<<>>" base64 is "PDw+Pg==" -> url-safe, unpadded: "PDw-Pg"
    expect(toBase64Url('<<>>')).toBe('PDw-Pg');
  });

  it('handles UTF-8 characters', () => {
    const encoded = toBase64Url('café');
    // decode back through the URL-safe alphabet to confirm round-trip
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(new TextDecoder().decode(bytes)).toBe('café');
  });
});

describe('buildRfc822', () => {
  it('builds headers and body separated by a blank line', () => {
    const raw = buildRfc822({
      to: 'student@school.edu',
      from: 'teacher@school.edu',
      subject: 'Great year!',
      body: 'You did well.\nKeep it up.',
    });
    expect(raw).toContain('To: student@school.edu');
    expect(raw).toContain('From: teacher@school.edu');
    expect(raw).toContain('Subject: Great year!');
    expect(raw).toContain('Content-Type: text/plain; charset="UTF-8"');
    // headers, blank line, then body
    const [headers, body] = raw.split('\r\n\r\n');
    expect(headers).toContain('Subject:');
    expect(body).toBe('You did well.\nKeep it up.');
  });

  it('encodes non-ASCII subjects as RFC 2047', () => {
    const raw = buildRfc822({
      to: 'a@b.com',
      from: 'c@d.com',
      subject: 'Félicitations',
      body: 'x',
    });
    expect(raw).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/send/rfc822.test.ts`
Expected: FAIL because `src/send/rfc822.ts` does not exist yet (import error).

- [ ] **Step 3: Write minimal implementation**
```ts
// src/send/rfc822.ts

export interface EmailFields {
  to: string;
  from: string;
  subject: string;
  body: string;
}

// Browser-safe UTF-8 base64url (no Node Buffer dependency).
export function toBase64Url(input: string): string {
  const utf8 = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of utf8) binary += String.fromCharCode(byte);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeSubject(subject: string): string {
  // Plain ASCII passes through; anything else uses RFC 2047 base64 word.
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
}

export function buildRfc822(fields: EmailFields): string {
  const headers = [
    `To: ${fields.to}`,
    `From: ${fields.from}`,
    `Subject: ${encodeSubject(fields.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
  ].join('\r\n');
  return `${headers}\r\n\r\n${fields.body}`;
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/send/rfc822.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/send/rfc822.ts src/send/rfc822.test.ts && git commit -m "Add RFC822 message builder and UTF-8 base64url encoder"`

---

### Task S6: Gmail API sender — users.messages.send call (network mocked)

**Files:**
- Create: `src/send/gmailSender.ts`
- Test: `src/send/gmailSender.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// src/send/gmailSender.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGmailSender } from './gmailSender';

// SendableMessage shape (from batchSendMachine): { id, email, finalText }
const message = { id: 'm1', email: 'student@school.edu', finalText: 'You did well.' };

describe('createGmailSender', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs a base64url raw message to users.messages.send with the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'gmail-123' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const send = createGmailSender({
      accessToken: 'tok-abc',
      from: 'teacher@school.edu',
      subject: 'Great year!',
    });
    await send(message);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    );
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-abc');
    expect(init.headers['Content-Type']).toBe('application/json');
    const sentBody = JSON.parse(init.body);
    expect(typeof sentBody.raw).toBe('string');
    // base64url: no +, /, or = characters
    expect(sentBody.raw).not.toMatch(/[+/=]/);
  });

  it('throws with the API error message on a non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid Credentials' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const send = createGmailSender({
      accessToken: 'expired',
      from: 'teacher@school.edu',
      subject: 'Great year!',
    });

    await expect(send(message)).rejects.toThrow('Invalid Credentials');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/send/gmailSender.test.ts`
Expected: FAIL because `src/send/gmailSender.ts` does not exist yet (import error).

- [ ] **Step 3: Write minimal implementation**
```ts
// src/send/gmailSender.ts
import { buildRfc822, toBase64Url } from './rfc822';

// SendableMessage shape from batchSendMachine: { id, email, finalText }
interface SendableMessage {
  id: string;
  email: string;
  finalText: string;
}

export interface GmailSenderConfig {
  accessToken: string;
  from: string;
  subject: string;
}

const SEND_URL =
  'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

// Returns a GmailSender: (message) => Promise<void>, compatible with runSend.
export function createGmailSender(config: GmailSenderConfig) {
  return async function send(message: SendableMessage): Promise<void> {
    const raw = toBase64Url(
      buildRfc822({
        to: message.email,
        from: config.from,
        subject: config.subject,
        body: message.finalText,
      }),
    );

    const res = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      let detail = `Gmail send failed (HTTP ${res.status})`;
      try {
        const data = await res.json();
        if (data?.error?.message) detail = data.error.message;
      } catch {
        // keep the HTTP-status fallback
      }
      throw new Error(detail);
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/send/gmailSender.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/send/gmailSender.ts src/send/gmailSender.test.ts && git commit -m "Add Gmail users.messages.send adapter (network mocked in tests)"`

---

### Task S7: Review screen — student+message list with grammar flags and confirm

**Files:**
- Create: `src/review/ReviewScreen.tsx`
- Test: `src/review/ReviewScreen.test.tsx`

- [ ] **Step 1: Write the failing test**
```tsx
// src/review/ReviewScreen.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewScreen } from './ReviewScreen';

// ReviewMessage shape: { id, name, email, finalText }
const messages = [
  { id: 'm1', name: 'Ada', email: 'ada@school.edu', finalText: 'You did did great.' },
  { id: 'm2', name: 'Carlos', email: 'carlos@school.edu', finalText: 'You worked hard.' },
];

describe('ReviewScreen', () => {
  it('lists every student with name, email, and message text', () => {
    render(<ReviewScreen messages={messages} onConfirm={vi.fn()} />);
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('ada@school.edu')).toBeInTheDocument();
    expect(screen.getByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText(/You worked hard/)).toBeInTheDocument();
  });

  it('shows grammar flags for a message that has issues', () => {
    render(<ReviewScreen messages={messages} onConfirm={vi.fn()} />);
    // "did did" -> double-word flag surfaced on Ada's row
    expect(screen.getByText(/Repeated word: "did"/)).toBeInTheDocument();
  });

  it('requires an explicit confirm checkbox before enabling the confirm button', () => {
    const onConfirm = vi.fn();
    render(<ReviewScreen messages={messages} onConfirm={onConfirm} />);
    const button = screen.getByRole('button', { name: /confirm/i });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/reviewed all/i));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/review/ReviewScreen.test.tsx`
Expected: FAIL because `src/review/ReviewScreen.tsx` does not exist yet (import error).

- [ ] **Step 3: Write minimal implementation**
```tsx
// src/review/ReviewScreen.tsx
import { useState, useMemo } from 'react';
import { grammarCheck, type GrammarIssue } from '../grammar/grammarCheck';

// Per-student message snapshot for review.
export interface ReviewMessage {
  id: string;
  name: string;
  email: string;
  finalText: string;
}

export interface ReviewScreenProps {
  messages: ReviewMessage[];
  onConfirm: () => void;
}

export function ReviewScreen({ messages, onConfirm }: ReviewScreenProps) {
  const [reviewed, setReviewed] = useState(false);

  const flagsByMessage = useMemo(() => {
    const map: Record<string, GrammarIssue[]> = {};
    for (const m of messages) map[m.id] = grammarCheck(m.finalText);
    return map;
  }, [messages]);

  return (
    <section aria-label="Review and send">
      <ol>
        {messages.map((m) => {
          const issues = flagsByMessage[m.id];
          return (
            <li key={m.id}>
              <div>
                <strong>{m.name}</strong> <span>{m.email}</span>
              </div>
              <p>{m.finalText}</p>
              {issues.length > 0 && (
                <ul aria-label={`Grammar flags for ${m.name}`}>
                  {issues.map((issue, i) => (
                    <li key={i}>{issue.message}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      <label>
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        I reviewed all {messages.length} messages and recipients.
      </label>

      <button type="button" disabled={!reviewed} onClick={onConfirm}>
        Confirm and continue to send
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/review/ReviewScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/review/ReviewScreen.tsx src/review/ReviewScreen.test.tsx && git commit -m "Add review screen listing students with grammar flags and explicit confirm"`

---

### Task S8: Mode A send panel — live progress bar + failures-to-retry list

**Files:**
- Create: `src/send/SendProgressPanel.tsx`
- Test: `src/send/SendProgressPanel.test.tsx`

- [ ] **Step 1: Write the failing test**
```tsx
// src/send/SendProgressPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SendProgressPanel } from './SendProgressPanel';

// SendState shape from batchSendMachine:
// { order, statuses, errors, phase }
const baseState = {
  order: ['m1', 'm2', 'm3'],
  statuses: { m1: 'sent', m2: 'failed', m3: 'pending' } as const,
  errors: { m2: 'quota exceeded' },
  phase: 'running' as const,
};

// Lookup for names/emails by id.
const names = {
  m1: { name: 'Ada', email: 'ada@school.edu' },
  m2: { name: 'Carlos', email: 'carlos@school.edu' },
  m3: { name: 'Mei', email: 'mei@school.edu' },
};

describe('SendProgressPanel', () => {
  it('shows progress as done/total', () => {
    render(<SendProgressPanel state={baseState} names={names} onRetry={vi.fn()} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '2'); // sent + failed
    expect(bar).toHaveAttribute('aria-valuemax', '3');
    expect(screen.getByText(/2 of 3/)).toBeInTheDocument();
  });

  it('lists failed messages with their error and a retry button', () => {
    const onRetry = vi.fn();
    render(<SendProgressPanel state={baseState} names={names} onRetry={onRetry} />);
    expect(screen.getByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText(/quota exceeded/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry failed/i }));
    expect(onRetry).toHaveBeenCalledWith(['m2']);
  });

  it('hides the retry button when there are no failures', () => {
    const cleanState = {
      ...baseState,
      statuses: { m1: 'sent', m2: 'sent', m3: 'sent' } as const,
      errors: {},
      phase: 'done' as const,
    };
    render(<SendProgressPanel state={cleanState} names={names} onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /retry failed/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/send/SendProgressPanel.test.tsx`
Expected: FAIL because `src/send/SendProgressPanel.tsx` does not exist yet (import error).

- [ ] **Step 3: Write minimal implementation**
```tsx
// src/send/SendProgressPanel.tsx
import { progressOf, failedIds, type SendState } from './batchSendMachine';

// SendState shape (from batchSendMachine): { order, statuses, errors, phase }
// progressOf -> { done, total, sent, failed }; failedIds -> string[]

export interface SendProgressPanelProps {
  state: SendState;
  names: Record<string, { name: string; email: string }>;
  onRetry: (failedIds: string[]) => void;
}

export function SendProgressPanel({ state, names, onRetry }: SendProgressPanelProps) {
  const { done, total, sent, failed } = progressOf(state);
  const failures = failedIds(state);

  return (
    <section aria-label="Send progress">
      <progress
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        value={done}
        max={total}
      />
      <p>
        {done} of {total} processed — {sent} sent, {failed} failed
      </p>

      {failures.length > 0 && (
        <div aria-label="Failures to retry">
          <h3>Failed — retry only these</h3>
          <ul>
            {failures.map((id) => (
              <li key={id}>
                <strong>{names[id]?.name ?? id}</strong>{' '}
                <span>{names[id]?.email}</span>
                <em>{state.errors[id]}</em>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onRetry(failures)}>
            Retry failed ({failures.length})
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/send/SendProgressPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/send/SendProgressPanel.tsx src/send/SendProgressPanel.test.tsx && git commit -m "Add Mode A send progress bar with failures-to-retry list"`

---

### Task S9: Mode B copy-paste fallback panel + auto-default when OAuth unavailable

**Files:**
- Create: `src/send/CopyPastePanel.tsx`
- Create: `src/send/chooseSendMode.ts`
- Test: `src/send/CopyPastePanel.test.tsx`
- Test: `src/send/chooseSendMode.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// src/send/chooseSendMode.test.ts
import { describe, it, expect } from 'vitest';
import { chooseSendMode } from './chooseSendMode';

describe('chooseSendMode', () => {
  it('defaults to Mode A when the Gmail-send scope is available', () => {
    expect(chooseSendMode({ gmailScopeGranted: true })).toBe('A');
  });

  it('auto-defaults to Mode B when OAuth/scope is unavailable', () => {
    expect(chooseSendMode({ gmailScopeGranted: false })).toBe('B');
  });

  it('honors an explicit per-batch override to Mode B even when scope exists', () => {
    expect(chooseSendMode({ gmailScopeGranted: true, override: 'B' })).toBe('B');
  });

  it('cannot override to Mode A when the scope is missing', () => {
    expect(chooseSendMode({ gmailScopeGranted: false, override: 'A' })).toBe('B');
  });
});
```
```tsx
// src/send/CopyPastePanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CopyPastePanel } from './CopyPastePanel';

const messages = [
  { id: 'm1', name: 'Ada', email: 'ada@school.edu', finalText: 'You did great.' },
  { id: 'm2', name: 'Carlos', email: 'carlos@school.edu', finalText: 'You worked hard.' },
];

describe('CopyPastePanel', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders a Copy button and email for each message', () => {
    render(<CopyPastePanel messages={messages} sent={{}} onMarkSent={vi.fn()} onMarkAllSent={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /^copy$/i })).toHaveLength(2);
    expect(screen.getByText('ada@school.edu')).toBeInTheDocument();
  });

  it('copies the message text to the clipboard', async () => {
    render(<CopyPastePanel messages={messages} sent={{}} onMarkSent={vi.fn()} onMarkAllSent={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^copy$/i })[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('You did great.');
  });

  it('marks an individual message as sent', () => {
    const onMarkSent = vi.fn();
    render(<CopyPastePanel messages={messages} sent={{}} onMarkSent={onMarkSent} onMarkAllSent={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: /mark as sent/i })[1]);
    expect(onMarkSent).toHaveBeenCalledWith('m2');
  });

  it('marks all messages as sent', () => {
    const onMarkAllSent = vi.fn();
    render(<CopyPastePanel messages={messages} sent={{}} onMarkSent={vi.fn()} onMarkAllSent={onMarkAllSent} />);
    fireEvent.click(screen.getByRole('button', { name: /mark all sent/i }));
    expect(onMarkAllSent).toHaveBeenCalledTimes(1);
  });

  it('shows a sent indicator for already-sent messages', () => {
    render(<CopyPastePanel messages={messages} sent={{ m1: true }} onMarkSent={vi.fn()} onMarkAllSent={vi.fn()} />);
    expect(screen.getByText(/Ada.*sent/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/send/chooseSendMode.test.ts src/send/CopyPastePanel.test.tsx`
Expected: FAIL because `src/send/chooseSendMode.ts` and `src/send/CopyPastePanel.tsx` do not exist yet (import errors).

- [ ] **Step 3: Write minimal implementation**
```ts
// src/send/chooseSendMode.ts

export type SendMode = 'A' | 'B';

export interface SendModeInput {
  gmailScopeGranted: boolean;
  override?: SendMode; // explicit per-batch toggle
}

// Mode A (Gmail) requires the scope; without it we always fall back to Mode B.
// An explicit override can force B, but can never force A when scope is missing.
export function chooseSendMode({ gmailScopeGranted, override }: SendModeInput): SendMode {
  if (!gmailScopeGranted) return 'B';
  return override ?? 'A';
}
```
```tsx
// src/send/CopyPastePanel.tsx

// Per-student message for the copy-paste fallback.
export interface CopyPasteMessage {
  id: string;
  name: string;
  email: string;
  finalText: string;
}

export interface CopyPastePanelProps {
  messages: CopyPasteMessage[];
  sent: Record<string, boolean>;
  onMarkSent: (id: string) => void;
  onMarkAllSent: () => void;
}

export function CopyPastePanel({
  messages,
  sent,
  onMarkSent,
  onMarkAllSent,
}: CopyPastePanelProps) {
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  return (
    <section aria-label="Copy-paste send (Mode B)">
      <button type="button" onClick={onMarkAllSent}>
        Mark all sent
      </button>
      <ol>
        {messages.map((m) => (
          <li key={m.id}>
            <div>
              <strong>{m.name}</strong>{' '}
              <span>{m.email}</span>{' '}
              {sent[m.id] && <span aria-label={`${m.name} sent`}>✓ sent</span>}
            </div>
            <pre>{m.finalText}</pre>
            <button type="button" onClick={() => copy(m.finalText)}>
              Copy
            </button>
            <button type="button" onClick={() => onMarkSent(m.id)}>
              Mark as sent
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/send/chooseSendMode.test.ts src/send/CopyPastePanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
`git add src/send/chooseSendMode.ts src/send/CopyPastePanel.tsx src/send/chooseSendMode.test.ts src/send/CopyPastePanel.test.tsx && git commit -m "Add Mode B copy-paste fallback panel and send-mode selection (auto-default to B)"`

### Task S20: ReviewScreen container wires the Review→Send handoff (Mode A runSend + Mode B copy-paste)

**Context.** The leaf `ReviewScreen` list (per-student preview rows + grammar flags) stays as-is. This task adds the **container** above it that owns the confirm→send orchestration. On confirm it must (1) `setBatchStatus('sending')`, (2) for **Mode A** invoke the injected `runSend` over the batch's messages while feeding the live `SendProgressPanel`, and on completion (3) `setBatchStatus('sent')`; for **Mode B** it reveals the copy-paste panel instead of transmitting. `runSend`, `setBatchStatus`, and the mode toggle are all injected (props) so the smoke test can drive them without Firebase or Gmail.

These imports come from the canonical `src/types.ts` (no re-declaration): `Batch`, `MessageDraft`.

**1. Failing test** — `src/review/ReviewScreenContainer.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Batch, MessageDraft } from '../types';
import { ReviewScreenContainer } from './ReviewScreenContainer';

function makeBatch(): Batch {
  return { id: 'b1', classId: 'c1', sharedHeader: 'Hi', status: 'draft' };
}

function makeMessages(): MessageDraft[] {
  return [
    { studentId: 's1', name: 'Ana', usedEntries: ['e1'], slotValues: {}, finalText: 'Hi Ana', status: 'draft' },
    { studentId: 's2', name: 'Ben', usedEntries: ['e2'], slotValues: {}, finalText: 'Hi Ben', status: 'draft' },
  ];
}

describe('ReviewScreenContainer', () => {
  it('Mode A: confirm calls setBatchStatus("sending") then runSend, then setBatchStatus("sent")', async () => {
    const calls: string[] = [];
    const setBatchStatus = vi.fn(async (status: Batch['status']) => { calls.push('status:' + status); });
    const runSend = vi.fn(async (msgs: MessageDraft[], onProgress: (m: MessageDraft) => void) => {
      calls.push('runSend');
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
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /send all/i }));

    await waitFor(() => expect(runSend).toHaveBeenCalledTimes(1));
    // ordering: status('sending') is set BEFORE runSend is invoked
    expect(calls).toEqual(['status:sending', 'runSend', 'status:sent']);
    // runSend received the batch's two messages
    expect(runSend.mock.calls[0][0]).toHaveLength(2);
    // live progress panel reflected the sent messages
    await waitFor(() => expect(screen.getByTestId('progress-sent-count').textContent).toBe('2'));
  });

  it('Mode B: confirm reveals copy-paste panel and never calls runSend', async () => {
    const setBatchStatus = vi.fn(async () => {});
    const runSend = vi.fn();

    render(
      <ReviewScreenContainer
        batch={makeBatch()}
        messages={makeMessages()}
        mode="B"
        runSend={runSend}
        setBatchStatus={setBatchStatus}
      />,
    );

    expect(screen.queryByTestId('copy-paste-panel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /send all/i }));

    await waitFor(() => expect(screen.getByTestId('copy-paste-panel')).toBeTruthy());
    expect(runSend).not.toHaveBeenCalled();
    expect(setBatchStatus).toHaveBeenCalledWith('sending');
  });
});
```

**2. Run / expect FAIL** (module does not exist yet)

```
npx vitest run src/review/ReviewScreenContainer.test.tsx
```

Expected: FAIL — `Failed to resolve import "./ReviewScreenContainer"`.

**3. Minimal implementation** — `src/review/ReviewScreenContainer.tsx`

```tsx
import { useState } from 'react';
import type { Batch, MessageDraft } from '../types';
import { ReviewScreen } from './ReviewScreen';
import { SendProgressPanel } from './SendProgressPanel';
import { CopyPastePanel } from './CopyPastePanel';

export type SendMode = 'A' | 'B';

/** Mode A sender: sends each message, calling onProgress as each resolves. */
export type RunSend = (
  messages: MessageDraft[],
  onProgress: (m: MessageDraft) => void,
) => Promise<MessageDraft[]>;

export interface ReviewScreenContainerProps {
  batch: Batch;
  messages: MessageDraft[];
  mode: SendMode;
  runSend: RunSend;
  setBatchStatus: (status: Batch['status']) => Promise<void> | void;
}

export function ReviewScreenContainer({
  batch,
  messages,
  mode,
  runSend,
  setBatchStatus,
}: ReviewScreenContainerProps) {
  // Live per-student results, updated as runSend reports progress.
  const [results, setResults] = useState<MessageDraft[]>(messages);
  const [sending, setSending] = useState(false);
  const [showCopyPaste, setShowCopyPaste] = useState(false);

  async function onConfirm() {
    // (1) Mark the batch as in-flight FIRST, regardless of mode.
    await setBatchStatus('sending');

    if (mode === 'B') {
      // Mode B: hand the finished messages over for manual copy-paste.
      setShowCopyPaste(true);
      return;
    }

    // Mode A: transmit via the injected sender, feeding the live progress panel.
    setSending(true);
    const sent = await runSend(messages, (m) => {
      setResults((prev) => prev.map((r) => (r.studentId === m.studentId ? m : r)));
    });
    setResults(sent);
    setSending(false);

    // (3) Completion: only the send-state machine flips the batch to 'sent'.
    await setBatchStatus('sent');
  }

  return (
    <div>
      <ReviewScreen messages={results} />

      {mode === 'A' && (sending || results.some((r) => r.status !== 'draft')) && (
        <SendProgressPanel results={results} />
      )}

      {mode === 'B' && showCopyPaste && (
        <CopyPastePanel messages={results} sharedHeader={batch.sharedHeader} />
      )}

      <button type="button" onClick={onConfirm}>
        Send all
      </button>
    </div>
  );
}
```

Supporting leaves the test depends on (the real `ReviewScreen` already exists from Step 5a; `SendProgressPanel` from Step 5b; `CopyPastePanel` from Mode B). The progress panel must expose the sent count the test asserts on:

`src/review/SendProgressPanel.tsx`

```tsx
import type { MessageDraft } from '../types';

export function SendProgressPanel({ results }: { results: MessageDraft[] }) {
  const sent = results.filter((r) => r.status === 'sent').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  return (
    <div role="status" aria-label="send progress">
      <span data-testid="progress-sent-count">{sent}</span> sent
      {failed > 0 && <span data-testid="progress-failed-count"> · {failed} failed</span>}
    </div>
  );
}
```

`src/review/CopyPastePanel.tsx`

```tsx
import type { MessageDraft } from '../types';

export function CopyPastePanel({
  messages,
  sharedHeader,
}: {
  messages: MessageDraft[];
  sharedHeader: string;
}) {
  return (
    <ul data-testid="copy-paste-panel">
      {messages.map((m) => (
        <li key={m.studentId}>
          <span>{m.name}</span>
          <pre>{sharedHeader}{'\n\n'}{m.finalText}</pre>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(`${sharedHeader}\n\n${m.finalText}`)}
          >
            Copy
          </button>
        </li>
      ))}
    </ul>
  );
}
```

(If `src/review/ReviewScreen.tsx` does not yet expose a `messages` prop, this container passes `results` through to it; the leaf list rendering is unchanged from Step 5a.)

**4. Run / expect PASS**

```
npx vitest run src/review/ReviewScreenContainer.test.tsx
```

Expected: PASS — both tests green. Mode A asserts the exact order `['status:sending', 'runSend', 'status:sent']`, that `runSend` got the batch's 2 messages, and that the live panel shows `2` sent. Mode B asserts the copy-paste panel appears, `runSend` is never called, and `setBatchStatus('sending')` still fired.

**5. Commit**

```
git add src/review/ReviewScreenContainer.tsx src/review/ReviewScreenContainer.test.tsx \
        src/review/SendProgressPanel.tsx src/review/CopyPastePanel.tsx
git commit -m "Wire Review→Send handoff: confirm → sending → runSend → sent (Mode A) / copy-paste reveal (Mode B)"
```

---

**What this corrects.** The orchestration now lives in the **container** (`ReviewScreenContainer`), not the leaf list: `onConfirm` sets `'sending'` *before* invoking `runSend`, threads `runSend`'s `onProgress` callback into the live `SendProgressPanel`, and flips the batch to `'sent'` only on completion. Mode B branches *after* `setBatchStatus('sending')` to reveal `CopyPastePanel` and never touches `runSend`. `runSend`, `setBatchStatus`, and `mode` are injected props (no Firebase/Gmail in the smoke test), and all message/batch shapes import from the canonical `src/types.ts` (`Batch.status` and `MessageDraft.status` per the locked types).

Relevant files (all under the repo at `/Users/shiebenaderet/Documents/GitHub/feedback`):
- `src/review/ReviewScreenContainer.tsx` (new — owns the orchestration)
- `src/review/ReviewScreenContainer.test.tsx` (new — smoke test)
- `src/review/SendProgressPanel.tsx`, `src/review/CopyPastePanel.tsx` (panels the container feeds)
- `src/review/ReviewScreen.tsx` (existing leaf list — unchanged)
- `src/types.ts` (canonical types imported, not re-declared)

### Task S21: Re-auth on token expiry (Gmail 401 → AUTH error → re-authorize → retry)

The send runner must distinguish an **auth failure** (expired/invalid Gmail token, HTTP 401) from a **per-message failure** (e.g. a single bad recipient). An auth failure is batch-wide: instead of marking one message `failed`, the UI surfaces a re-authorization prompt that re-runs `signInWithGoogle` to refresh the Gmail-send scope, then lets the teacher retry. We test the pure classifier first, then the hook behavior with everything mocked.

**Step 1 — Failing test for the pure classifier.**

```typescript
// src/send/isAuthError.test.ts
import { describe, it, expect } from 'vitest';
import { isAuthError } from './isAuthError';

describe('isAuthError', () => {
  it('classifies HTTP 401 as an auth error', () => {
    expect(isAuthError({ status: 401 })).toBe(true);
  });

  it('classifies a gapi-style 401 (error.code) as an auth error', () => {
    expect(isAuthError({ error: { code: 401, message: 'Invalid Credentials' } })).toBe(true);
  });

  it('classifies an invalid-credentials / invalid_token reason as an auth error', () => {
    expect(isAuthError({ status: 403, message: 'invalid_grant: token expired' })).toBe(true);
    expect(isAuthError({ result: { error: { status: 'UNAUTHENTICATED' } } })).toBe(true);
  });

  it('does NOT classify a per-message failure (bad recipient / 400 / 500) as an auth error', () => {
    expect(isAuthError({ status: 400, message: 'Invalid To header' })).toBe(false);
    expect(isAuthError({ status: 500 })).toBe(false);
    expect(isAuthError(new Error('network timeout'))).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
    expect(isAuthError(null)).toBe(false);
  });
});
```

**Step 2 — Run, expect FAIL.**

```bash
npx vitest run src/send/isAuthError.test.ts
```

Expected: FAIL — `Cannot find module './isAuthError'` (the implementation does not exist yet).

**Step 3 — Minimal implementation.**

```typescript
// src/send/isAuthError.ts

/**
 * Pure classifier: is this thrown value an AUTH failure (expired/invalid Gmail
 * token / missing scope), as opposed to a per-message send failure?
 *
 * Auth failures are batch-wide: the runner must STOP and re-authorize, not mark
 * a single message `failed`. Anything we cannot positively identify as auth is
 * treated as a per-message failure (safer: it gets retried per-message, not by
 * forcing a re-login).
 */
export function isAuthError(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;

  // Normalize the various shapes Gmail/gapi/fetch throw.
  const e = err as Record<string, any>;
  const status: unknown = e.status ?? e.error?.code ?? e.result?.error?.code;
  const statusText: string = String(
    e.result?.error?.status ?? e.error?.status ?? '',
  ).toUpperCase();
  const message: string = String(
    e.message ?? e.error?.message ?? e.result?.error?.message ?? '',
  ).toLowerCase();

  if (status === 401) return true;
  if (statusText === 'UNAUTHENTICATED') return true;

  // Token-expiry signals that may ride on a non-401 status.
  return (
    message.includes('invalid_grant') ||
    message.includes('invalid credentials') ||
    message.includes('invalid_credentials') ||
    message.includes('invalid_token') ||
    message.includes('token expired') ||
    message.includes('token has expired')
  );
}
```

**Step 4 — Run, expect PASS.**

```bash
npx vitest run src/send/isAuthError.test.ts
```

Expected: PASS — all 4 cases green.

**Step 5 — Commit.**

```bash
git add src/send/isAuthError.ts src/send/isAuthError.test.ts
git commit -m "Add isAuthError classifier: distinguish Gmail 401/token-expiry from per-message failures"
```

---

Now the **UI hook behavior**: on an auth error the runner sets a re-auth prompt (it does NOT mark messages failed); confirming re-auth calls `signInWithGoogle`, clears the prompt, and re-runs the batch.

**Step 1 — Failing test for the hook (Gmail send + auth mocked).**

```typescript
// src/send/useSendRunner.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { MessageDraft } from '../types';
import { useSendRunner } from './useSendRunner';

// Mock the Gmail sender and the Google sign-in helper.
const sendOne = vi.fn();
const signInWithGoogle = vi.fn();

vi.mock('./gmailSender', () => ({ sendOne: (...a: unknown[]) => sendOne(...a) }));
vi.mock('../firebase/auth', () => ({
  signInWithGoogle: (...a: unknown[]) => signInWithGoogle(...a),
}));

const drafts = (): MessageDraft[] => [
  { studentId: 's1', name: 'Ana', usedEntries: [], slotValues: {}, finalText: 'Hi Ana', status: 'draft' },
  { studentId: 's2', name: 'Ben', usedEntries: [], slotValues: {}, finalText: 'Hi Ben', status: 'draft' },
];

beforeEach(() => {
  sendOne.mockReset();
  signInWithGoogle.mockReset();
});

describe('useSendRunner — re-auth on token expiry', () => {
  it('on a 401 it halts, surfaces re-auth (does NOT mark a message failed)', async () => {
    // First message: token expired (batch-wide auth error).
    sendOne.mockRejectedValueOnce({ status: 401, message: 'Invalid Credentials' });

    const { result } = renderHook(() => useSendRunner(drafts()));
    await act(async () => { await result.current.start(); });

    await waitFor(() => expect(result.current.needsReauth).toBe(true));
    // Halted before the second message; nothing marked failed.
    expect(sendOne).toHaveBeenCalledTimes(1);
    expect(result.current.messages.every((m) => m.status === 'draft')).toBe(true);
    expect(result.current.failures).toHaveLength(0);
  });

  it('re-authorize re-runs signInWithGoogle, clears the prompt, and retries the batch', async () => {
    sendOne.mockRejectedValueOnce({ status: 401 }); // first attempt: token expired
    signInWithGoogle.mockResolvedValueOnce({ uid: 'teacher-1' });
    sendOne.mockResolvedValue({ id: 'gmail-msg' }); // after re-auth: all succeed

    const { result } = renderHook(() => useSendRunner(drafts()));
    await act(async () => { await result.current.start(); });
    await waitFor(() => expect(result.current.needsReauth).toBe(true));

    await act(async () => { await result.current.reauthorizeAndRetry(); });

    await waitFor(() => expect(result.current.needsReauth).toBe(false));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(result.current.messages.every((m) => m.status === 'sent')).toBe(true);
    expect(result.current.failures).toHaveLength(0);
  });

  it('a per-message (non-auth) failure marks that message failed and continues', async () => {
    sendOne
      .mockRejectedValueOnce({ status: 400, message: 'Invalid To header' }) // s1: bad recipient
      .mockResolvedValueOnce({ id: 'gmail-msg' });                           // s2: ok

    const { result } = renderHook(() => useSendRunner(drafts()));
    await act(async () => { await result.current.start(); });

    await waitFor(() => expect(result.current.done).toBe(true));
    expect(result.current.needsReauth).toBe(false);
    expect(result.current.messages.find((m) => m.studentId === 's1')!.status).toBe('failed');
    expect(result.current.messages.find((m) => m.studentId === 's2')!.status).toBe('sent');
    expect(result.current.failures.map((m) => m.studentId)).toEqual(['s1']);
  });
});
```

**Step 2 — Run, expect FAIL.**

```bash
npx vitest run src/send/useSendRunner.test.tsx
```

Expected: FAIL — `Cannot find module './useSendRunner'`.

**Step 3 — Minimal implementation.**

```typescript
// src/send/useSendRunner.ts
import { useState, useCallback, useRef } from 'react';
import type { MessageDraft } from '../types';
import { sendOne } from './gmailSender';
import { signInWithGoogle } from '../firebase/auth';
import { isAuthError } from './isAuthError';

export interface SendRunner {
  messages: MessageDraft[];
  failures: MessageDraft[];
  needsReauth: boolean;
  done: boolean;
  sending: boolean;
  start: () => Promise<void>;
  reauthorizeAndRetry: () => Promise<void>;
}

/**
 * Batch-send state machine (Mode A). Sends one message at a time; marks each
 * `sent`/`failed` individually. A per-message failure NEVER halts the batch.
 * An AUTH error (isAuthError) DOES halt: it sets `needsReauth` and leaves the
 * remaining messages as `draft` so the retry resends only what's outstanding.
 */
export function useSendRunner(initial: MessageDraft[]): SendRunner {
  const [messages, setMessages] = useState<MessageDraft[]>(initial);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const mark = (studentId: string, status: MessageDraft['status']) =>
    setMessages((prev) => {
      const next = prev.map((m) => (m.studentId === studentId ? { ...m, status } : m));
      messagesRef.current = next;
      return next;
    });

  const runOutstanding = useCallback(async () => {
    setSending(true);
    setNeedsReauth(false);
    // Resend only messages not already sent.
    for (const m of messagesRef.current.filter((x) => x.status !== 'sent')) {
      try {
        await sendOne(m);
        mark(m.studentId, 'sent');
      } catch (err) {
        if (isAuthError(err)) {
          // Batch-wide: stop, do NOT mark this message failed, request re-auth.
          setNeedsReauth(true);
          setSending(false);
          return;
        }
        mark(m.studentId, 'failed');
      }
    }
    setSending(false);
    setDone(true);
  }, []);

  const start = useCallback(() => runOutstanding(), [runOutstanding]);

  const reauthorizeAndRetry = useCallback(async () => {
    await signInWithGoogle(); // refreshes the Gmail-send scope / token
    await runOutstanding();
  }, [runOutstanding]);

  const failures = messages.filter((m) => m.status === 'failed');
  return { messages, failures, needsReauth, done, sending, start, reauthorizeAndRetry };
}
```

> Supporting stubs the hook imports (created here so the suite is self-contained; their full behavior is owned by the Mode A send step and the Foundation auth step):

```typescript
// src/send/gmailSender.ts
import type { MessageDraft } from '../types';
// Real impl posts to the Gmail API as the teacher. Tests mock this module.
export async function sendOne(_msg: MessageDraft): Promise<{ id: string }> {
  throw new Error('gmailSender.sendOne not wired in this context');
}
```

```typescript
// src/firebase/auth.ts
// Real impl runs Firebase signInWithPopup(GoogleAuthProvider) with the
// gmail.send scope. Tests mock this module.
export async function signInWithGoogle(): Promise<{ uid: string }> {
  throw new Error('signInWithGoogle not wired in this context');
}
```

**Step 4 — Run, expect PASS.**

```bash
npx vitest run src/send/useSendRunner.test.tsx
```

Expected: PASS — the 401 halts with `needsReauth` (no message marked failed), re-auth calls `signInWithGoogle` and resends to completion, and a non-auth 400 marks only that message failed while the batch continues.

**Step 5 — Commit.**

```bash
git add src/send/useSendRunner.ts src/send/useSendRunner.test.tsx src/send/gmailSender.ts src/firebase/auth.ts
git commit -m "Add useSendRunner re-auth flow: 401 halts batch + re-prompts signInWithGoogle, then retries"
```

---

### Task S22: Disable send on an already-sent batch (Batch.status gating + explicit "Send again")

Per the spec ("Accidental double-send → sent batches disable the Send button; resending is explicit"), the ReviewScreen send panel reads `Batch.status` (from `src/types.ts`). When `status === 'sent'` the primary **Send** action renders **disabled**, and re-sending is gated behind an explicit **"Send again"** affordance that requires a confirm before it calls `setBatchStatus` to flip the batch back to `'sending'`.

**Step 1 — Failing test.**

```tsx
// src/review/SendPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Batch } from '../types';
import { SendPanel } from './SendPanel';

const setBatchStatus = vi.fn();
vi.mock('../firebase/batches', () => ({
  setBatchStatus: (...a: unknown[]) => setBatchStatus(...a),
}));

const draftBatch: Batch = { id: 'b1', classId: 'c1', sharedHeader: 'Hello', status: 'draft' };
const sentBatch: Batch = { id: 'b1', classId: 'c1', sharedHeader: 'Hello', status: 'sent' };

beforeEach(() => setBatchStatus.mockReset());

describe('SendPanel — double-send protection', () => {
  it('draft batch: primary Send is enabled and there is no re-send affordance', () => {
    render(<SendPanel batch={draftBatch} onSend={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^send all$/i })).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: /send again/i })).toBeNull();
  });

  it("sent batch: primary Send is disabled and an explicit 'Send again' affordance is shown", () => {
    render(<SendPanel batch={sentBatch} onSend={vi.fn()} />);
    const send = screen.getByRole('button', { name: /^send all$/i });
    expect(send).toBeDisabled();
    expect(screen.getByText(/already been sent/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send again/i })).toBeInTheDocument();
  });

  it("sent batch: 'Send again' gates re-send behind a confirm before flipping status", () => {
    const onSend = vi.fn();
    render(<SendPanel batch={sentBatch} onSend={onSend} />);

    // First click reveals confirm; it does NOT send or flip status yet.
    fireEvent.click(screen.getByRole('button', { name: /send again/i }));
    expect(setBatchStatus).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: /yes, re-send/i });

    // Confirm: flips the batch back to 'sending' and triggers the send.
    fireEvent.click(confirm);
    expect(setBatchStatus).toHaveBeenCalledWith('b1', 'sending');
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2 — Run, expect FAIL.**

```bash
npx vitest run src/review/SendPanel.test.tsx
```

Expected: FAIL — `Cannot find module './SendPanel'`.

**Step 3 — Minimal implementation.**

```tsx
// src/review/SendPanel.tsx
import { useState } from 'react';
import type { Batch } from '../types';
import { setBatchStatus } from '../firebase/batches';

export interface SendPanelProps {
  batch: Batch;
  onSend: () => void;
}

/**
 * Review-screen send panel. Reads Batch.status to prevent accidental
 * double-sends: a `sent` batch disables the primary Send action, and re-sending
 * is gated behind an explicit "Send again" + confirm before flipping the batch
 * back to `sending` (via setBatchStatus) and invoking the actual send.
 */
export function SendPanel({ batch, onSend }: SendPanelProps) {
  const alreadySent = batch.status === 'sent';
  const [confirming, setConfirming] = useState(false);

  const handleSend = () => onSend();

  const handleResendConfirmed = () => {
    setBatchStatus(batch.id, 'sending');
    setConfirming(false);
    onSend();
  };

  return (
    <div>
      <button type="button" onClick={handleSend} disabled={alreadySent}>
        Send all
      </button>

      {alreadySent && (
        <div role="status">
          <p>This batch has already been sent.</p>
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)}>
              Send again
            </button>
          ) : (
            <>
              <p>Re-send to every recipient in this batch?</p>
              <button type="button" onClick={handleResendConfirmed}>
                Yes, re-send
              </button>
              <button type="button" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

> Supporting stub the panel imports (full data-access behavior is owned by the batches CRUD step; it writes `teachers/{uid}/batches/{batchId}.status` per the canonical paths). Created here so the suite is self-contained:

```typescript
// src/firebase/batches.ts
import type { Batch } from '../types';
// Real impl: setDoc(doc(db, 'teachers', uid, 'batches', batchId), { status }, { merge: true }).
// Tests mock this module.
export async function setBatchStatus(_batchId: string, _status: Batch['status']): Promise<void> {
  throw new Error('setBatchStatus not wired in this context');
}
```

**Step 4 — Run, expect PASS.**

```bash
npx vitest run src/review/SendPanel.test.tsx
```

Expected: PASS — a `draft` batch shows an enabled "Send all" and no re-send affordance; a `sent` batch shows a disabled "Send all" plus an explicit "Send again" that, only after the "Yes, re-send" confirm, calls `setBatchStatus('b1', 'sending')` and triggers `onSend`.

**Step 5 — Commit.**

```bash
git add src/review/SendPanel.tsx src/review/SendPanel.test.tsx src/firebase/batches.ts
git commit -m "Add SendPanel double-send guard: disable Send on sent batch, gate re-send behind confirm + setBatchStatus"
```

---

**Notes on canonical-decision compliance** (file paths returned for reference):
- `/Users/shiebenaderet/Documents/GitHub/feedback/src/types.ts` — both tasks import `MessageDraft` and `Batch` from here; no shapes re-declared. `Batch.status` is `'draft'|'sending'|'sent'` and re-send flips to `'sending'`, matching the canonical union.
- `/Users/shiebenaderet/Documents/GitHub/feedback/src/firebase/batches.ts` (`setBatchStatus`) writes under `teachers/{uid}/batches/{batchId}` per Canonical Decision 1; it imports `{ db }` from `src/firebase/config.ts` in its real impl (Decision 3).
- `/Users/shiebenaderet/Documents/GitHub/feedback/src/firebase/auth.ts` (`signInWithGoogle`) is the Foundation Google-sign-in helper that re-grants the Gmail-send scope; the runner only consumes it.
- `firestore.rules` is untouched (owned by Foundation Task 9); these tasks add no competing rules.
- The repo is currently greenfield (only the spec file exists under `docs/superpowers/specs/`), so these blocks define new files; `vitest` + `@testing-library/react` are assumed wired by the Foundation step.

