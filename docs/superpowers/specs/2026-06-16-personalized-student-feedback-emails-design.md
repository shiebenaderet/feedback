# Personalized Student Feedback Emails — Design

**Date:** 2026-06-16
**Author:** Shie Benaderet (with Claude)
**Status:** Approved for implementation planning

## Purpose

A single-teacher web app that turns a class roster and a tagged bank of comment/story
templates into personalized, reviewable, batch-sent emails to students. The teacher
filters a class, picks a shared header, assembles each student's message from the bank
(with names and other details auto-filled), reviews the batch, and sends — all from one
account, with work saved across sessions.

**Pilot goal:** Send end-of-year emails to every student across the teacher's classes
(under 150 students total).

**Longer-term vision:** A year-long feedback companion — track behavior, successes, and
areas of growth per student, so students hear from the teacher regularly. The pilot is
built so this vision slots in later with no rewrite.

## Decisions (locked)

| Area | Decision | Rationale |
|---|---|---|
| Scope | Pilot-first, history-ready | Ship the end-of-year send now; model the full domain so history is additive later. |
| Send method | As the teacher, via Gmail (Google Workspace) | Best deliverability, replies return to inbox; Google sign-in doubles as login. |
| Scale | <150 students, Workspace account | ~7% of daily quota → single-pass send, no queue/throttle subsystem needed. |
| Personalization | Templates with fill-in slots | Auto slots (name, semester) save typing; "you-fill" slots keep it personal. Same shape as the future history record. |
| Bank tags | type / area / objective / tone | Maps to behavior/success/growth tracking. unit/project deferred. |
| Compose UX | Three-panel, one student at a time | Roster (left) · message builder (middle) · bank picker (right). Keeps each message personal; roster tracks progress. |
| Backend | Firebase (Auth + Firestore + Hosting) | Least glue code; built-in Google sign-in and per-user security rules; free at this scale. |
| Persistence | Auto-save to Firestore | "Save my work across sessions" — quit mid-class and resume. |
| Send infra | Send from the browser | No server code, no Blaze plan; keep tab open ~30s per class. |
| Send safety | Preview list + explicit confirm | Catch a wrong email or unfinished message before send. |
| Spelling | Browser-native, live as you type | Free, private, familiar red-underline. |
| Grammar | Local/offline pass on review screen | Catches grammar/style before send; **no student data leaves the device**. |
| Access gating | Public landing page + Firestore rules + email allowlist | UI gate deters stumbling; rules are the real guarantee; allowlist limits sign-in to the teacher. |

## Architecture

Single-page React app talking directly to Firebase. No self-hosted server.

```
   Browser (React app)
        │
        ├─ Firebase Auth ──── Google sign-in (also requests Gmail-send scope)
        │
        ├─ Firestore ──────── classes, students, bankEntries, batches, messages
        │                     (Security Rules: only the owner can read/write)
        │
        └─ Send step ──────── Gmail API, sending AS the teacher, from the browser
```

The only logic that isn't plain CRUD: CSV import parsing, template slot-filling, the
batch-send state machine, and the local grammar pass. These get real tests.

## Data Model (Firestore)

All collections are owned by and private to the signed-in teacher.

```
teacher (the signed-in user; uid is the owner key)
 ├── classes/
 │    • name (e.g. "Period 3 Biology")
 │    • period, semester, unit metadata
 │    └── students/
 │         • name, email, period
 │         • imported from CSV
 ├── bankEntries/
 │    • templateText (with {slots})
 │    • slots: [{ key, kind: "auto"|"fill", hint }]
 │    • tags: { type, area, objective, tone }   (unit/project later)
 └── batches/                                   (one "send job")
      • classId, sharedHeader, status: draft|sending|sent
      └── messages/                             (per-student)
           • studentId, name (snapshot)
           • usedEntries: [bankEntryId, ...]
           • slotValues: { key: value }         (the "you-fill" answers)
           • finalText
           • status: draft|sent|failed
```

**Key design choice — the `message` record does triple duty:**
1. **In-progress draft** — an unsent message is the "save my work" feature.
2. **The thing that gets sent.**
3. **A year-long history entry** — future "what did I send Carlos this year?" is just a
   query over his `messages`. History is therefore additive, not a migration.

## Screens

1. **Landing (public)** — the only thing an unauthenticated visitor sees. Describes the
   tool; single "Sign in with Google" button. Any deep link while signed out bounces here.
2. **Sign in** — Google sign-in granting login + Gmail-send scope in one step. Restricted
   to an email allowlist (the teacher's account) for the pilot.
3. **Classes / roster** — list of classes; CSV import with a **preview step** (column
   mapping, blank-email and duplicate detection, bad rows shown and skipped, not silently
   dropped); roster view sortable by name.
4. **Bank** — create/edit/tag/filter/search comment & story entries (template + slots + tags).
5. **Compose** — three-panel: roster with progress tracking (left) · message builder with
   shared header and spellcheck-enabled editor (middle) · tag-filtered bank picker (right).
   One student at a time; **Save & next** advances; every edit auto-saves to Firestore.
6. **Review & send** — full batch laid out; per-student preview; **local grammar pass
   flags issues here**; explicit confirm; Gmail send with live progress bar and a
   failures-to-retry list.

## Send Flow

1. Teacher finishes a batch, clicks **Send**.
2. Confirmation screen: recipient list (spot-checkable) + "Send all".
3. Per student, send via Gmail API from the browser; mark each `sent`/`failed` as it goes,
   with a live progress bar.
4. Failures listed at the end; retry touches **only** the failed messages.

## Error Handling & Data Safety

- **Messy CSV** → import preview catches blank emails, bad formats, odd column orders, and
  duplicates before saving. Bad rows are shown and skipped, never silently dropped.
- **Lost work** → auto-save to Firestore on every edit; a crash loses at most one sentence.
- **Partial send failure** → batch never halts; messages marked individually; retry hits
  only failures.
- **Token expiry / send limit** → re-prompt to re-authorize rather than fail silently;
  daily cap not a concern at <150.
- **Wrong message to wrong student** → review screen pairs each name with its message and
  requires confirm; `{name}` is drawn from the same record being sent, so they can't desync.
- **Accidental double-send** → sent batches disable the Send button; resending is explicit.
- **Stranger reaches the data** → Firestore Security Rules deny all access to non-owners,
  so even bypassing the UI returns nothing. The landing page is the lock; the rules are the vault.

Theme: nothing irreversible without a confirm; nothing destructive happens silently.

## Testing

- **Test-driven for the risky logic:** CSV parsing (messy-data cases), template slot-filling
  (auto resolution; unfilled "you-fill" slots caught before send), batch-send state machine
  (partial failure marking; retry isolation).
- **Security rules tested:** prove another account cannot read the teacher's students.
- **UI smoke tests:** a couple of integration tests for compose and review-send; not
  pixel-tested.
- **No live emails in tests:** Gmail send is mocked.

## Build Sequence

Built in data-flow order so each step is testable with real data from the previous one:

1. **Foundation** — React + Firebase project; Google sign-in; landing page + allowlist;
   security rules in place.
2. **Roster** — CSV import with preview → students saved → roster view.
3. **Bank** — create/edit/tag/filter comment entries.
4. **Compose** — three-panel screen, auto-save, Save & next.
5. **Review & send** — preview, local grammar pass, confirm, Gmail send with progress + retry.

By step 2 a class loads; by step 5 the end-of-year pilot runs end to end. Stopping after
step 3 still yields a useful roster + bank.

## Explicitly Deferred (designed-for, not built in the pilot)

- **unit / project tags** on bank entries (same tag scheme, additive).
- **Year-long history views** (the data accumulates now; this is later just a view).
- **Multi-teacher support** (pilot is single-teacher).
- **Cloud Function sending** ("fire and forget"; pilot sends from the browser).
- **Smarter cloud grammar** (pilot uses the local pass; cloud/self-hosted LanguageTool later).

## Pre-Build Verification

- **District OAuth policy:** Confirm the school Google Workspace admin permits third-party
  OAuth apps with the Gmail-send scope. If blocked, request an allowlist for the app, or
  fall back to "generate drafts" sending. Verify before building, not at launch.
