# Student Feedback Emails

A single-teacher web app that turns a class roster and a tagged bank of comment
templates into personalized, reviewable, batch-sent end-of-year emails to students —
with your work saved across sessions.

Built for **Mr. B.'s 8th-grade U.S. History** classroom, but usable by any teacher.

## What works today

- **Google sign-in**, gated to an allowlist of approved teacher emails. Unauthenticated
  visitors see only a landing page.
- **Roster management:** create classes, import students from a CSV (with a preview that
  shows what was found and what was skipped, and why), and view a sortable roster.
- All student data is private per-teacher, enforced by Firestore security rules.

## Coming next

Bank (comment templates), Compose (the three-panel writing screen), and Send
(Gmail send + copy-paste fallback). See
`docs/superpowers/plans/2026-06-16-personalized-student-feedback-emails.md`.

## Tech stack

Vite + React + TypeScript, Firebase (Auth + Firestore + Hosting), Vitest +
React Testing Library, PapaParse.

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up Firebase** — follow [SETUP.md](./SETUP.md). You'll create a Firebase
   project, enable Google sign-in, and copy your config into a `.env.local` file.

3. **Run the app**

   ```bash
   npm run dev
   ```

   Open the printed `localhost` URL, click **Sign in with Google**, and you'll land on
   the home page with a **Manage roster** link.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server. |
| `npm test` | Run the unit test suite (Vitest). |
| `npm run build` | Type-check and build the production bundle. |
| `npm run test:rules` | Run the Firestore security-rules test (needs the emulator + **JDK 21+**). |

## Testing the security rules

The rules-unit test proves a stranger cannot read your students. It needs the Firestore
emulator, which requires **JDK 21 or newer**. With that installed:

```bash
npm run test:rules
```

It is intentionally excluded from `npm test` so the normal suite runs without the emulator.
