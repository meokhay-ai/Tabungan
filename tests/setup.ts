import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);

import { webcrypto } from 'node:crypto';

if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}

process.env.DRIZZLE_DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.SESSION_SECRET ??= 'tabungan-test-session-secret-at-least-32-chars';
process.env.STELLAR_NETWORK ??= 'testnet';
process.env.STELLAR_HORIZON_URL ??= 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK_PASSPHRASE ??= 'Test SDF Network ; September 2015';
process.env.USDC_ASSET_CODE ??= 'USDC';
process.env.USDC_ASSET_ISSUER_TESTNET ??=
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
process.env.DEMO_MODE ??= 'true';

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => {
      const listeners = new Set<(e: MediaQueryListEvent) => void>();
      const mql = {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: (event: string, cb: EventListenerOrEventListenerObject) => {
          if (event === 'change') listeners.add(cb as (e: MediaQueryListEvent) => void);
        },
        removeEventListener: (event: string, cb: EventListenerOrEventListenerObject) => {
          if (event === 'change') listeners.delete(cb as (e: MediaQueryListEvent) => void);
        },
        addListener: (cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
        removeListener: (cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
        dispatchEvent: () => true,
      } as unknown as MediaQueryList;
      return mql;
    },
  });
}
