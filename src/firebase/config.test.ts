// src/firebase/config.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Firebase SDK so we test our wiring, not the network.
// Typed to accept the config arg so `.mock.calls[0][0]` is well-typed under tsc.
const initializeApp = vi.fn((_config: Record<string, unknown>) => ({ name: 'test-app' }));
const getApps = vi.fn(() => [] as unknown[]);
const getApp = vi.fn(() => ({ name: 'existing-app' }));
const getAuth = vi.fn(() => ({ kind: 'auth' }));
const getFirestore = vi.fn(() => ({ kind: 'firestore' }));

vi.mock('firebase/app', () => ({ initializeApp, getApps, getApp }));
vi.mock('firebase/auth', () => ({ getAuth }));
vi.mock('firebase/firestore', () => ({ getFirestore }));

describe('firebase config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    getApps.mockReturnValue([]);
  });

  it('initializes the app with config from import.meta.env', async () => {
    const { app, auth, db } = await import('./config');
    expect(initializeApp).toHaveBeenCalledTimes(1);
    const passedConfig = initializeApp.mock.calls[0][0] as Record<string, unknown>;
    expect(passedConfig).toHaveProperty('apiKey');
    expect(passedConfig).toHaveProperty('projectId');
    expect(getAuth).toHaveBeenCalledWith(app);
    expect(getFirestore).toHaveBeenCalledWith(app);
    expect(auth).toEqual({ kind: 'auth' });
    expect(db).toEqual({ kind: 'firestore' });
  });

  it('reuses an existing app instead of re-initializing', async () => {
    getApps.mockReturnValue([{ name: 'existing-app' }]);
    await import('./config');
    expect(initializeApp).not.toHaveBeenCalled();
    expect(getApp).toHaveBeenCalledTimes(1);
  });
});
