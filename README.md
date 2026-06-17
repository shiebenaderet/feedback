# Student Feedback Emails

A single-teacher web app that turns your class rosters and a tagged bank of comment
templates into personalized, reviewable, batch-sent feedback emails to students — and
keeps a durable history of every message so you can see how each student is growing over
the year.

Built for **Mr. B.'s 8th-grade U.S. History** classroom, but usable by any teacher.

Live at **https://feedbackams.web.app** (sign-in is gated to an allowlist of teacher emails).

---

## How it's organized

The app models a real teaching load: you teach **one or two courses**, each running across
**several periods**, and you write feedback for those students **repeatedly** over the year.

```
Year  →  Course(s)  →  Period(s)  →  Roster (students)  →  Feedback history (per student)
```

- A **Year** (e.g. "2025–26") is created automatically and rolls over each August.
- A **Course** is the subject you teach ("U.S. History"). You can have more than one
  (7th and 8th grade), and you can rename, archive, or delete a course.
- A **Period** is a class section (Period 1–6, plus any custom ones you add).
- A **Roster** is the students in a period.
- **Feedback history** is the durable, longitudinal record: every message you send is
  stored against the student, tagged by grading period, so you can pull trends later
  ("last time I told you… you improved at… you should focus on…").

A single shared **comment bank** is used across every course and period.

---

## What it does

**Set up your year**
- Add a course and check the periods you teach (1–6, plus custom). Periods are generated
  for you. Manage courses any time: rename, archive, delete.

**Build each roster — three ways**
- **Upload a CSV** (download the template first; the preview shows exactly what was found
  and what was skipped, and why).
- **Type students in** one at a time.
- **Paste a list** (one student per line).

**Write feedback**
- A focused three-panel compose screen: pick comment-bank templates, fill the blanks, and
  the message assembles itself. A shared header sits atop every message in the batch.
- Per-student **history is visible while you write**, so you build on what you said before.
- Progress is tracked per period so you know who's left.

**Choose the grading period**
- Before sending, tag the batch with a grading period (Q1–Q4, S1, S2, EOY) plus an
  optional free-text label ("Unit 3 reflections"). This is stamped on every history entry.

**Review & send**
- **Gmail send** ("as you") when your account allows it, or a **copy-paste fallback** for
  locked-down school Workspace accounts — so an admin block never stops you.
- Each sent message writes one durable `feedbackHistory` entry (raw template choices and
  derived tags), best-effort so a history hiccup never breaks a send.

**See trends**
- Per-period and per-course trends pages aggregate the history to surface patterns
  ("lots of students need to participate more," "claims are weak") to inform your teaching.

All student data is private per-teacher, enforced by Firestore security rules.

---

## Navigation

A top nav bar (**Home · Bank · Sign out**) plus breadcrumbs (**Year › Course › Period**)
on every screen. The home dashboard shows a card per course with per-period feedback
progress and quick links to **Write feedback** and **Trends**.

---

## Architecture (for contributors)

- **Vite + React + TypeScript** SPA. Routing via React Router.
- **Firebase**: Auth (Google sign-in, allowlisted), Firestore (data), Hosting (live site).
- **Firestore path:**
  `teachers/{uid}/years/{yearId}/courses/{courseId}/periods/{periodId}/students/{studentId}/feedbackHistory/{entryId}`.
  A single recursive security rule (`match /teachers/{ownerUid}/{document=**}`) restricts
  every read/write to the owning teacher. History trend queries use a Firestore
  `collectionGroup` over `feedbackHistory` filtered by a stamped `ownerUid` field.
- **Config-driven taxonomy** (`src/feedback/taxonomy.ts`): sentiment mapping, the fixed
  grading periods, and tag categories all live in one module so they can be revisited
  without a rewrite. History stores the **raw** template choices (`usedEntries`), so tags
  and trends are always re-derivable if the taxonomy changes.
- **Data-access functions** are dependency-injected — `(db, uid, …args, deps?)` with
  injectable Firestore primitives — so they unit-test without the emulator.
- **Testing**: Vitest + React Testing Library, written test-first. The rules test runs
  against the Firestore emulator and is kept out of the default suite (it needs JDK 21+).

Source layout (high level):

| Path | Responsibility |
|---|---|
| `src/pages/` | Route-level screens (Setup, Home, Roster, Compose, ReviewSend). |
| `src/data/` | Firestore CRUD for the year→course→period→student→history tree. |
| `src/feedback/` | Taxonomy, history writing, and tag/progress derivation. |
| `src/compose/` | The compose screen and message-assembly logic. |
| `src/review/` & `src/send/` | Review orchestration, Gmail send, copy-paste fallback. |
| `src/roster/` | CSV / paste / manual roster entry and parsing. |
| `src/bank/` | The shared comment bank. |
| `src/components/` & `src/ui/` | Shared UI (nav, breadcrumbs, chooser) and design tokens. |

The design spec and implementation plan live in `docs/superpowers/`.

---

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up Firebase** — follow [SETUP.md](./SETUP.md). You'll create a Firebase project,
   enable Google sign-in, create Firestore, copy your config into `.env.local`, and
   publish the security rules.

3. **Run the app**

   ```bash
   npm run dev
   ```

   Open the printed `localhost` URL, click **Sign in with Google**, and you'll land on the
   home dashboard.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server. |
| `npm test` | Run the unit test suite (Vitest). |
| `npm run build` | Type-check and build the production bundle. |
| `npm run deploy` | Build and deploy the live site to Firebase Hosting (see SETUP.md Step 8). |
| `npm run test:rules` | Run the Firestore security-rules test (needs the emulator + **JDK 21+**). |

---

## Testing the security rules

The rules-unit test proves a stranger cannot read your students. It needs the Firestore
emulator, which requires **JDK 21 or newer**:

```bash
npm run test:rules
```

It is intentionally excluded from `npm test` so the normal suite runs without the emulator.
