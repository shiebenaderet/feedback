/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

// Dedicated config for the Firestore security-rules test. Unlike the default
// config, it does NOT exclude rules.test.ts and runs in a node environment
// (the test talks to the Firestore emulator, not the DOM). Run via `npm run
// test:rules`, which wraps this in `firebase emulators:exec` (requires JDK 21+).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/firebase/rules.test.ts'],
  },
});
