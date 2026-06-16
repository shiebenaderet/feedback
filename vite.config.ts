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
    // The Firestore security-rules test needs a running emulator (JDK 21+).
    // It is excluded from the default unit-test run and executed explicitly via
    // the "test:rules" script (firebase emulators:exec ...).
    // `.worktrees/**` holds isolated git worktrees whose tests must not be
    // re-discovered by the root checkout.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.worktrees/**',
      // Emulator-backed tests (need the Firestore emulator + JDK 21+); run via test:rules.
      'src/firebase/rules.test.ts',
      'src/bank/bankRules.test.ts',
      'src/firebase/batches.test.ts',
      'src/firebase/messages.test.ts',
    ],
  },
});
