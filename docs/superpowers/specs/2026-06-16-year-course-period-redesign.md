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
          feedbackHistory/{entryId}   ← DURABLE per-student feedback record (see below)
  bankEntries/{entryId}       ← ONE shared bank (unchanged), tag-ready for future "standard" tag
  batches/{batchId}           ← a feedback send-job (the ACT of sending); keyed to a periodId
    messages/{studentId}      ← per-student draft (the working copy during compose)
```

- **Year** is a top-level grouping with a label (defaults to the current school year).
- **Course** belongs to a year; a year can have multiple courses (7th + 8th).
- **Period** belongs to a course; created by checking 1–6 or adding a custom label.
- **Students** belong to a period (was: belonged to a class).
- **`semester`/`unit` are removed from setup.** Grading-period stamping lives on the batch/history
  (see Longitudinal feedback), not on the class.
- **Batch.classId → Batch.periodId.** A feedback send-job targets one period's roster.

> Migration note: existing flat `classes/{id}` data is early test data and may be discarded or
> left orphaned; the redesign does not attempt automated migration (per "do it right" decision).

## Longitudinal feedback (history + trends) — the durable layer

The single most important architectural decision: **a batch is the *act of sending*; the durable
record is per-student `feedbackHistory`.** When a feedback round is sent (or marked sent in
copy-paste mode), each student's message is written as a **`feedbackHistory` entry under that
student**, independent of the batch. Batches/messages remain the transient working copy; history is
the permanent, queryable archive that survives end-of-year and powers continuity + trends.

**`feedbackHistory/{entryId}` shape:**
```
{
  studentId, periodId, courseId, yearId,   // location in the tree (denormalized for querying)
  sentAt: <timestamp>,                       // when this round went out
  gradingPeriod: 'Q1'|'Q2'|'Q3'|'Q4'|'S1'|'S2'|'EOY',  // fixed, chosen per batch
  label?: string,                            // optional free-text ('Unit 3 reflections')
  finalText: string,                         // the message the student received
  tags: {                                    // STRUCTURED metadata, inherited from the bank entries used
    areas: string[],        // e.g. ['cer','discussion'] — from used entries' tags.area
    sentiments: ('strength'|'growth'|'neutral')[],  // from used entries' tags.type:
                                            //   success→strength, growth→growth,
                                            //   behavior/skill→neutral (not a strength/growth axis)
    standards: string[],    // future: from a 'standard' tag on entries (empty for now)
  },
  usedEntries: string[],                     // bank entry ids, for traceability
}
```

**Key property — trend data is captured for free.** The teacher composes as normal (picking bank
comments, filling slots); the structured `tags` are inherited automatically from the bank entries
used. The only thing set per round is the **grading period** (+ optional label), chosen once when
the batch starts and stamped on every message. No extra tagging work.

**Design principle — classification choices are config, not baked-in (revisit without an overhaul).**
The sentiment mapping (`success→strength`, etc.), the grading-period list, and the tag categories
live in **one config module** (e.g. `src/feedback/taxonomy.ts`) that the send, history, and trends
code all read from. Changing a mapping later = editing one file, not hunting through features. And
because every `feedbackHistory` entry stores the **raw `usedEntries` (bank entry ids)** alongside
the derived tags, trends can be **re-derived under a new mapping at any time** — the source data is
never lost, only its interpretation is configurable. This is what makes "I'll want to revisit these
choices later" safe: the taxonomy is swappable and the history is reclassifiable.

**Two history surfaces (both built):**
1. **Inline-while-composing** — when writing a student's *next* round, a panel shows their recent
   `feedbackHistory` (dated: "Oct 12 · Q1 — speak up more in debates"), so the teacher writes with
   continuity ("last time we talked about…").
2. **Per-student history page** — a chronological view of everything ever sent to one student,
   across grading periods, for the full year-long picture.

**Trends page (per period and per course):** aggregates `feedbackHistory` to inform teaching —
e.g. "14 students flagged for weak claims (CER) this quarter", strength-vs-growth balance, and the
same metrics compared across grading periods. Queryable by area, sentiment, standard, and period.

**Grading period:** chosen once per batch (fixed Q1/Q2/Q3/Q4/S1/S2/EOY **plus** an optional
free-text label), stamped on every message + history entry in that round.

**End-of-year archive:** because history lives under each student independent of batches, archiving
a course/year hides it from the active dashboard but preserves all `feedbackHistory` for recall and
trend analysis. Nothing is lost on archive.

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
5. **"Start writing feedback →"** enters the compose flow for that period. The compose flow now
   shows the **inline history panel** per student, and the **review/send step asks for the grading
   period** (Q1–Q4/S1/S2/EOY + optional label) once before sending.

## Home dashboard (the hub)

- Top nav bar: logo "Feedback" · **Home** · **Bank** · **Sign out**.
- Breadcrumb row reflecting location (`Year › Course › Period`), clickable to navigate up.
- Greeting ("Welcome back, Mr. B.").
- **Course cards** — per course: name, period chips, and **per-period feedback progress**
  (e.g. "Period 4 · 12/29 sent" with a thin teal bar) + a **"Write feedback"** link and a
  **"Trends"** link per period.
- **"+ Add a course"** card.
- A small **"Your comment bank · N templates →"** entry point.

## Navigation

- **Top nav bar** (persistent): Home · Bank · Sign out.
- **Breadcrumbs** under the nav: `2025–26 › 8th Grade U.S. History › Period 4`, each crumb a link
  up the tree. This is both wayfinding and a constant reminder of the hierarchy.
- Routes: `/` (home), `/setup` (courses & periods), `/course/:courseId/period/:periodId/roster`,
  `/course/:courseId/period/:periodId/compose`, `/review/:batchId`, `/bank`,
  `/student/:studentId/history` (per-student history page),
  `/course/:courseId/period/:periodId/trends` (and a course-level trends rollup).

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
methods + CSV template + manual + paste), re-pointing batches from classId → periodId, and the
**longitudinal layer**: writing `feedbackHistory` on send (tags inherited from used bank entries +
grading-period stamp), the inline compose-history panel, the per-student history page, and the
per-period/per-course Trends page that aggregates history.

## Testing & build approach

- TDD as before: new data fns (createYear/createCourse/createPeriod/listCourses/listPeriods,
  updateStudent/deleteStudent reused) unit-tested with DI'd Firestore mocks; new screens
  smoke-tested with mocked data layer + auth.
- Firestore security rules extended to cover the deeper `teachers/{uid}/years/.../students` paths
  AND the `feedbackHistory` subcollection (still owner-only); rules test updated.
- The structured-tag aggregation for Trends is pure, unit-tested logic over `feedbackHistory[]`
  (count by area/sentiment/standard/gradingPeriod) — testable without Firestore.
- Build in dependency order: data model (incl. feedbackHistory) → setup flow → roster →
  navigation/home → re-point compose/send to periodId → write history on send + grading-period
  step → history surfaces (inline + page) → Trends page → UI polish pass → deploy.

## Out of scope (deferred)

- Standards-based comment *content* — the `standard` tag dimension is wired into the history
  schema + Trends now (so it aggregates the moment such comments exist), but authoring a standards
  library is a later content task.
- Automated migration of old flat-class data.
- Multi-year management UX beyond a simple year label (one year is the common case).
- Cross-course/whole-roster trend rollups beyond per-period and per-course (could come later).
