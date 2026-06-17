# Firebase Setup — Step by Step

This gets your app talking to a real Firebase project so you can sign in and save data.
It takes about 10 minutes. You do this **once**.

> You'll need a Google account. Use the same one (or your school Workspace account) you
> want to sign in to the app with.

---

## Step 1 — Create a Firebase project

1. Go to **https://console.firebase.google.com/**.
2. Click **Add project** (or **Create a project**).
3. Name it something like `student-feedback-emails`. Click **Continue**.
4. On "Google Analytics," you can toggle it **off** (you don't need it). Click **Create project**.
5. Wait for it to finish, then click **Continue**.

---

## Step 2 — Register a Web App

1. On your project's home screen, click the **`</>`** (Web) icon — "Add an app to get started."
2. App nickname: `feedback-web`. **Do not** check "Firebase Hosting" yet. Click **Register app**.
3. Firebase shows you a **config object** that looks like this:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "student-feedback-emails.firebaseapp.com",
     projectId: "student-feedback-emails",
     storageBucket: "student-feedback-emails.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abc123def456",
   };
   ```

4. **Keep this tab open** — you'll copy these values in Step 5. (You can always find them
   later under **Project settings ⚙️ → General → Your apps**.)

---

## Step 3 — Turn on Google sign-in

1. In the left sidebar, click **Build → Authentication**.
2. Click **Get started**.
3. On the **Sign-in method** tab, click **Google** in the provider list.
4. Toggle **Enable** on.
5. Pick a **support email** (your email) from the dropdown.
6. Click **Save**.

---

## Step 4 — Create the Firestore database

1. In the left sidebar, click **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in production mode** (our security rules will protect the data — don't
   use test mode). Click **Next**.
4. Pick a location close to you (e.g. `nam5 (us-central)`). Click **Enable**.

> The app's security rules live in `firestore.rules` in this repo. You'll publish them in
> Step 7 so only you can read your students' data.

---

## Step 5 — Put your config into the app

1. In the project repo, **copy** the example env file:

   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` in your editor and fill in the values **from Step 2's config object**.
   Match them up like this:

   | In `.env.local` | Comes from `firebaseConfig.` |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

3. Set the **allowlist** to your own email — this is who is allowed to sign in:

   ```
   VITE_TEACHER_ALLOWLIST=your-email@yourschool.org
   ```

   (You can list more than one, comma-separated.)

4. Save the file. **`.env.local` is git-ignored**, so your keys never get committed.

---

## Step 6 — Run the app

```bash
npm install      # if you haven't already
npm run dev
```

Open the `localhost` URL it prints. Click **Sign in with Google**, choose your account,
and you should land on the home dashboard, where you can set up a course and start a
roster. 🎉

> If sign-in is rejected, double-check that the email you signed in with exactly matches
> `VITE_TEACHER_ALLOWLIST` in `.env.local`, then restart `npm run dev`.

---

## Step 7 — Publish the security rules (protects student data)

Until you do this, your database uses Firebase's default rules. Publish ours so only you
can read your data.

**Option A — Console (quickest):**
1. Firebase Console → **Build → Firestore Database → Rules** tab.
2. Open `firestore.rules` from this repo, copy its entire contents.
3. Paste it into the Rules editor (replacing what's there) and click **Publish**.

**Option B — Firebase CLI:**
```bash
npx firebase login
npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

> The rules restrict every read/write to `teachers/{yourUid}/...` to *you*. Everyone else —
> including other signed-in Google users — is denied. This is the real guarantee that
> student data stays private (the sign-in allowlist is a second, softer layer).

---

## Step 8 — Publish the live site (Firebase Hosting)

This puts your app on the web at `https://YOUR_PROJECT_ID.web.app`. The landing page is
public; signing in reveals the tool (only allowlisted emails get in).

1. **Enable Hosting** in the Console: Build → **Hosting** → **Get started** → click through
   (you can ignore the CLI snippets it shows; we've already set things up).

2. **Tell the CLI which project this is.** From the repo root:

   ```bash
   npx firebase login                       # if you haven't already
   npx firebase use --add                   # pick YOUR_PROJECT_ID, give it the alias "default"
   ```

   This creates a `.firebaserc` file pointing at your project.

3. **Build and deploy:**

   ```bash
   npm run deploy
   ```

   This runs `npm run build` (producing `dist/`) and `firebase deploy --only hosting`.
   When it finishes, it prints your live URL: **`https://YOUR_PROJECT_ID.web.app`**. 🎉

4. **Authorize the live domain for sign-in:** Firebase Console → Authentication → **Settings**
   → **Authorized domains** → add `YOUR_PROJECT_ID.web.app` (and `YOUR_PROJECT_ID.firebaseapp.com`).
   Otherwise Google sign-in will refuse on the live site with `auth/unauthorized-domain`.

> **Important — your config in the deployed build.** Vite bakes `.env.local` values into the
> build at `npm run build` time. The Firebase web config (`apiKey`, etc.) is *meant* to be
> public — it identifies your project, it is not a secret. Your **security rules** (Step 7)
> are what actually protect the data. Just make sure `.env.local` is filled in before you
> `npm run deploy`.

Re-deploy any time with `npm run deploy`.

---

## Gmail sending (optional)

Sending email "as you" from the Review & send screen needs the **Gmail API** enabled on
your Firebase/Google Cloud project and an OAuth consent screen with the
`gmail.send` scope. If you skip this — or if your **school Workspace admin** blocks
third-party apps — the app automatically falls back to a **copy-paste** flow that walks
you through each message, so a block never stops you.

---

## Troubleshooting

- **"auth/unauthorized-domain"** on sign-in → Firebase Console → Authentication → Settings →
  **Authorized domains** → add `localhost` (it's usually there by default).
- **Sign-in pops up then bounces you out** → your email isn't in `VITE_TEACHER_ALLOWLIST`.
  Fix `.env.local` and restart `npm run dev`.
- **Changes to `.env.local` don't take effect** → stop and restart `npm run dev`
  (Vite only reads env vars at startup).
