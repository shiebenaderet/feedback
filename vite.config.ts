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
    exclude: ['**/node_modules/**', '**/dist/**', 'src/firebase/rules.test.ts'],
  },
});
