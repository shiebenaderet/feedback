# Standards, Canvas Assignment Flow, Security & Performance — Design

**Date:** 2026-06-17
**Author:** Shie Benaderet (with Claude)
**Status:** Plan — groundwork buildable now; Canvas live-posting gated on district API access

This doc plans the next phase: making feedback **standards-aware**, adding a **Canvas
assignment flow** for summative grading, and the **security + performance** steps to do
before this holds real student PII. It builds on what already shipped: unit tagging, the
trajectory dashboard, quick rounds, build-on-last-time callbacks, the editable message
field, and the expanded comment bank.

---

## 1. Standards integration

**Goal:** tag comments by WA state standard, pick standards while composing, and slice
trends/history by standard — so feedback ties to the curriculum, not just an "area."

### What's already in place
The history model was built to support this with almost no new plumbing:
- `FeedbackHistoryEntry.tags.standards: string[]` already exists and `deriveHistoryTags`
  already reads a `standard` tag defensively (today it's empty because seed entries carry
  no standard).
- So once bank comments carry a standard code, trends can group by standard immediately.

### Data we need
The standards live in `standards-data.js` (the `STANDARDS` array) behind your Standards
Progression Map page. Shape (inferred from the viewer):

```js
STANDARDS = [{
  code: 'C2',                // standard code
  title: '...',              // standard title
  strand: 'civics' | 'economics' | 'geography' | 'history' | 'skills',
  components: [{ code, text, grade: '6'|'7'|'8'|'all', sub?: string[] }],
}]
```

**Action:** share the page URL so I can fetch `standards-data.js`, or paste it. With it I'll
build `src/standards/standards.ts` (typed `STANDARDS`, plus lookups by code/strand/grade,
filtered to Grade 8 / U.S. History for your course by default).

### Plan
1. **`src/standards/` module** — typed standards data + helpers (`byCode`, `forGrade(8)`,
   `byStrand`). Pure, unit-tested.
2. **Tag the bank by standard** — extend `BankTags` with `standard?: string` (or `standards?: string[]`)
   and add codes to the relevant seed comments (e.g. the CER/DBQ/thesis comments → the
   inquiry/argument skills standards). `deriveHistoryTags` already surfaces them.
3. **Standard picker in compose** — a filter alongside the existing type filter, so you can
   pull "comments for standard C2." Optional: a standard chip on each composed message.
4. **Standard slicing in trends + the trajectory dashboard** — reuse the unit-filter pattern
   just shipped: a standard filter that narrows both aggregations, so you can see a student's
   growth *on a specific standard* across the year. This is the real payoff: "Maria moved
   from developing→proficient on 'analyze multiple perspectives' between the Revolution and
   Constitution units."

---

## 2. Canvas assignment flow (summative)

**Goal:** after grading a summative assignment in Canvas, open this companion, write a
per-student comment (standard-aware, from the bank or free-typed), and get it **into Canvas**
as a submission comment — not email.

### Reality check on access
There is **no Canvas/Instructure connector** available, so this would talk directly to the
Canvas REST API, which needs a developer key / token your **district** controls. You
indicated the district likely blocks third-party API access. So the design mirrors the email
model you already have: a **copy-paste fallback as the default**, with an **API path that
slots in later** if/when access is granted. The whole flow up to "deliver" is identical
either way — exactly like Gmail Mode A vs. copy-paste Mode B.

### New domain: Assignment
```
Assignment (under teacher → year → course)
  • title (e.g. "Revolution DBQ")
  • standardCodes: string[]      // links the assignment to one or more standards
  • summative: boolean
  • periodIds: string[]          // which sections it covers
  • canvasAssignmentId?: string  // set if/when Canvas API is wired
```

### Flow
1. **Create assignment** → title + link standard(s) + mark summative + pick periods.
2. **Grade in Canvas as usual** (outside this tool).
3. **Open the companion for that assignment** → a roster of its students, each with the
   editable message field + the standard-aware bank pre-filtered to the linked standard(s),
   + the build-on-last-time history panel. (This is the existing compose surface, scoped to
   an assignment instead of a generic round.)
4. **Deliver — two modes (per the email pattern):**
   - **Copy-paste (default, no API):** for each student, a one-click **Copy** of the comment,
     with their name shown, so you paste it into Canvas SpeedGrader's comment box. Plus a
     "mark posted" toggle to keep history accurate (same as email Mode B).
   - **Canvas API (later, if access granted):** `POST /api/v1/courses/:courseId/assignments/:assignmentId/submissions/:userId`
     with `comment[text_comment]`, authed by a Canvas token. Needs a roster↔Canvas-user
     mapping (by email or SIS id). This is purely additive — the compose/history layer is shared.
5. **History** — each posted comment writes a `feedbackHistory` entry stamped with the
   assignment + its standard(s) + unit, so the trajectory dashboard and standard slicing
   light up automatically.

### Build order
1. Assignment entity + CRUD + "create assignment / link standard" UI. *(no external dep)*
2. Assignment-scoped compose (reuse existing compose, scoped + standard-prefiltered). *(no dep)*
3. Copy-paste-to-Canvas delivery + history stamping. *(no dep — usable end-to-end today)*
4. Canvas API delivery + roster mapping. *(gated on district API access)*

Stopping after step 3 already gives you a working, standards-tagged, summative-feedback
workflow whose output you paste into Canvas — no district approval required.

---

## 3. Security hardening — before storing real student PII

From the security review. The core data-isolation design is sound (owner-only recursive
rule + collectionGroup-over-feedbackHistory fail closed; no XSS; no leaked secrets).
Already done in code: corrected the misleading "rules enforce the allowlist" comments;
added `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`
to hosting; documented the rules hardening inline in `firestore.rules`.

**Do these (need your console / your exact email):**

1. **Enable Firebase App Check (HIGH).** Without it, anyone with the public web config can
   hammer your project APIs (they still can't read student data — rules block that — but
   they can burn quota / probe). Console → App Check → register the web app with reCAPTCHA
   Enterprise (or v3), then add to `src/firebase/config.ts`:
   ```ts
   import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
   initializeAppCheck(app, {
     provider: new ReCaptchaEnterpriseProvider('<your-site-key>'),
     isTokenAutoRefreshEnabled: true,
   });
   ```
   Start in monitoring mode, then set Firestore + Auth to **enforced**.

2. **Enforce the allowlist server-side (MEDIUM).** Today any Google account can create its
   own empty tree by hitting Firestore directly. In `firestore.rules`, append to the `allow`
   condition (snippet is in the file's comments):
   ```
   && request.auth.token.email in ['<your-teacher-email>']
   && request.auth.token.email_verified == true
   ```
   Then `firebase deploy --only firestore:rules`. If you add `email_verified`, also pass
   `{ email_verified: true }` in the rules-unit-test auth contexts so `npm run test:rules`
   still passes.

3. **Add a Content-Security-Policy (LOW, test before shipping).** Belt-and-suspenders for the
   Gmail token vs. any future XSS. It needs the inline theme-init script in `index.html`
   moved to an external `/theme-init.js` (or hashed), and must be tested against Google
   sign-in. Candidate header for `firebase.json`:
   ```
   Content-Security-Policy: default-src 'self';
     script-src 'self' https://www.gstatic.com https://apis.google.com;
     style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;
     connect-src 'self' https://*.googleapis.com https://*.firebaseio.com
       https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://*.firebaseio.com;
     frame-src 'self' https://*.firebaseapp.com https://accounts.google.com;
     base-uri 'self'; object-src 'none'; frame-ancestors 'none'
   ```
   Deploy, confirm sign-in + send still work, then keep.

4. **FERPA / district (process, not code).** Confirm the Firebase project is under your
   district's Google Workspace for Education / DPA; document a student-record
   retention/deletion path (there's no purge flow today); pin Google sign-in to the school
   Workspace domain (`hd` param) once the teacher account is a Workspace account.

---

## 4. Performance — done + next

**Done:** route-level code-splitting + Firebase/React vendor chunks. First load dropped from
a single ~720 KB bundle to a ~6 KB entry + ~164 KB React vendor; Firebase (~440 KB) and each
route now load on demand as cacheable chunks. The landing/sign-in path no longer pulls the
whole app.

**Next (optional):**
- Per-service Firebase modular imports + lazy Firestore init to shrink the 440 KB Firebase chunk.
- Prefetch the likely next route (e.g. warm HomePage from the landing page) for snappier nav.
- Firestore: the dashboard does N per-period reads; batch where possible as rosters grow.
