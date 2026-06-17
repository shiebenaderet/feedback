# Year → Course → Period Redesign — Design

**Date:** 2026-06-16
**Author:** Shie Benaderet (Mr. B.) with Claude
**Status:** Approved for implementation planning
**Supersedes:** the flat single-"class" model from the original design.

## Why

The original model treats every "class" as a standalone thing. But a teacher teaches one or
more **courses** (e.g. 7th-grade AND 8th-grade U.S. History), each running across several
**periods/sections**, each period with its own roster. "Period" is a property of a section, not a
separate class; "semester/unit" don't belong at class setup at all. This redesign matches how
teaching actually works and adds the navigation, flow, and UI the app was missing.

## New data model

```
teachers/{uid}/
  years/{yearId}              ← e.g. "2025–26"  (label)
    courses/{courseId}        ← e.g. "8th Grade U.S. History" (name, archived?)
      periods/{periodId}      ← a section: label ("Period 3", "A Block"), order
        students/{studentId}  ← name, email
  bankEntries/{entryId}       ← ONE shared bank (unchanged), tag-ready for future "standard" tag
  batches/{batchId}           ← a feedback send-job, now keyed to a periodId (was classId)
    messages/{studentId}      ← per-student draft (unchanged shape)
```

- **Year** is a top-level grouping with a label (defaults to the current school year).
- **Course** belongs to a year; a year can have multiple courses (7th + 8th).
- **Period** belongs to a course; created by checking 1–6 or adding a custom label.
- **Students** belong to a period (was: belonged to a class).
- **`semester`/`unit` are removed from setup.** They may return later as optional *tags on a
  feedback batch* (e.g. "Unit 3 reflections"), not on the class.
- **Batch.classId → Batch.periodId.** A feedback send-job targets one period's roster.

> Migration note: existing flat `classes/{id}` data is early test data and may be discarded or
> left orphaned; the redesign does not attempt automated migration (per "do it right" decision).

## Setup flow

1. **Year** — on first use (no years exist), the app auto-creates a default year labeled with the
   current school year (e.g. "2025–26") and selects it, so the teacher lands straight in setup
   without a blank state. The label is editable; most teachers stay in one year.
2. **Add a course** — a card: **Course name** (text) + **periods** as checkboxes **1–6** plus an
   **"+ Add custom period"** affordance for odd names ("A Block", "Advisory"). "Create course"
   generates one period (section) per checked/added period. Repeat to add another course.
3. **Existing courses** list — each course card shows its name + period chips, with
   **Rename / Archive / Delete** (delete gated by typed confirmation, as today).
4. **Per period — build the roster** three ways (all visible, cohesive):
   - **Upload CSV** with a **"Download template"** button that produces a correctly-formatted
     `name,email` CSV to fill and re-upload (uses the existing messy-data-tolerant parser + preview).
   - **Type manually** — name + email fields + "Add student", appending to a small list.
   - **Paste a list** — a textarea; "Parse & add" runs the same parser over pasted rows.
5. **"Start writing feedback →"** enters the compose flow for that period.

## Home dashboard (the hub)

- Top nav bar: logo "Feedback" · **Home** · **Bank** · **Sign out**.
- Breadcrumb row reflecting location (`Year › Course › Period`), clickable to navigate up.
- Greeting ("Welcome back, Mr. B.").
- **Course cards** — per course: name, period chips, and **per-period feedback progress**
  (e.g. "Period 4 · 12/29 sent" with a thin teal bar) + a **"Write feedback"** link per period.
- **"+ Add a course"** card.
- A small **"Your comment bank · N templates →"** entry point.

## Navigation

- **Top nav bar** (persistent): Home · Bank · Sign out.
- **Breadcrumbs** under the nav: `2025–26 › 8th Grade U.S. History › Period 4`, each crumb a link
  up the tree. This is both wayfinding and a constant reminder of the hierarchy.
- Routes: `/` (home), `/setup` (courses & periods), `/course/:courseId/period/:periodId/roster`,
  `/course/:courseId/period/:periodId/compose`, `/review/:batchId`, `/bank`.

## Comment bank

- **One shared bank** across all courses/periods (unchanged). Composing filters by tags.
- The **"add a comment" flow must be fast** — the teacher plans to add many, including
  **standards-based comments** later. The tag system stays open so a future **`standard`** tag
  category slots in without a model change. (No bank-splitting; no per-course banks.)

## UI overhaul (B+C, everywhere)

Apply the B+C design (dark canvas, teal accent, panels, monospace tokens, generous spacing) to
**all** screens, matching the polish of the already-built send stepper. The recent global.css
baseline (styled form primitives) stays; per-screen layout work brings home/setup/roster/compose/
review/bank up to the mockup quality. Cards, breadcrumbs, period chips, progress bars, and the
calm-dark surface are consistent throughout.

## What's reused vs. rebuilt

**Reused (largely intact):** the comment bank + seed bank, the compose engine (slot-filling,
assembleMessage, ComposeScreen, fill-slot UI), the send machine (batchSendMachine, makeRunSend),
the polished **SendStepper** copy-paste screen, grammar checks, the CSV parser + import preview,
auth + security-rules approach (rules extended to the new nested paths).

**Rebuilt/new:** the data model (year/course/period), the setup flow (course + period checkboxes +
custom), the home dashboard, the navigation (nav bar + breadcrumbs), the roster screen (3 entry
methods + CSV template + manual + paste), and re-pointing batches from classId → periodId.

## Testing & build approach

- TDD as before: new data fns (createYear/createCourse/createPeriod/listCourses/listPeriods,
  updateStudent/deleteStudent reused) unit-tested with DI'd Firestore mocks; new screens
  smoke-tested with mocked data layer + auth.
- Firestore security rules extended to cover the deeper `teachers/{uid}/years/.../students` paths
  (still owner-only); rules test updated.
- Build in dependency order: data model → setup flow → roster → navigation/home → re-point
  compose/send to periodId → UI polish pass → deploy.

## Out of scope (deferred)

- Semester/unit as batch tags (the hooks exist in the model thinking; not built now).
- Standards-based comment tag category (bank stays tag-open; not built now).
- Automated migration of old flat-class data.
- Multi-year management UX beyond a simple year label (one year is the common case).
