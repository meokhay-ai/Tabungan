'use client';

import {
  getAddress as freighterGetAddress,
  isConnected as freighterIsConnected,
  requestAccess as freighterRequestAccess,
  signTransaction as freighterSignTransaction,
} from '@stellar/freighter-api';
import { useCallback, useEffect, useState } from 'react';

type State = {
  publicKey: string | null;
  isAvailable: boolean;
  isConnected: boolean;
  loading: boolean;
  error: string | null;
};

const INITIAL: State = {
  publicKey: null,
  isAvailable: false,
  isConnected: false,
  loading: true,
  error: null,
};

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Freighter ${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

const AVAILABILITY_TIMEOUT_MS = 2_000;
const CONNECT_TIMEOUT_MS = 120_000;
const SIGN_TIMEOUT_MS = 90_000;

/** Pin signing to the app's own network, never the wallet's active one. */
function appPassphrase(): string {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'public'
    ? 'Public Global Stellar Network ; September 2015'
    : 'Test SDF Network ; September 2015';
}

export function useFreighter() {
  const [state, setState] = useState<State>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { isConnected: connected } = await withTimeout(
          freighterIsConnected(),
          AVAILABILITY_TIMEOUT_MS,
          'isConnected',
        );
        if (cancelled) return;
        if (!connected) {
          setState({ ...INITIAL, loading: false });
          return;
        }
        try {
          const { address } = await withTimeout(
            freighterGetAddress(),
            AVAILABILITY_TIMEOUT_MS,
            'getAddress',
          );
          if (cancelled) return;
          setState({
            publicKey: address || null,
            isAvailable: true,
            isConnected: Boolean(address),
            loading: false,
            error: null,
          });
        } catch {
          if (cancelled) return;
          setState({ ...INITIAL, isAvailable: true, loading: false });
        }
      } catch {
        if (cancelled) return;
        setState({ ...INITIAL, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async (): Promise<string | null> => {
    try {
      const result = await withTimeout(
        freighterRequestAccess(),
        CONNECT_TIMEOUT_MS,
        'requestAccess',
      );
      if ('error' in result && result.error) throw new Error(String(result.error));
      const { address } = result;
      if (!address) throw new Error('Freighter returned no address');
      setState({
        publicKey: address,
        isAvailable: true,
        isConnected: true,
        loading: false,
        error: null,
      });
      return address;
    } catch (err) {
      setState((s) => ({ ...s, error: (err as Error).message }));
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    setState((s) => ({ ...s, isConnected: false, publicKey: null }));
  }, []);

  /** Sign any unsigned XDR (auth challenge, payment, trustline). */
  const signXdr = useCallback(
    async (xdr: string, address?: string): Promise<string> => {
      const pk = address ?? state.publicKey;
      if (!pk) throw new Error('Wallet not connected');
      const result = await withTimeout(
        freighterSignTransaction(xdr, { address: pk, networkPassphrase: appPassphrase() }),
        SIGN_TIMEOUT_MS,
        'signTransaction',
      );
      if ('error' in result && result.error) throw new Error(String(result.error));
      return (result as { signedTxXdr: string }).signedTxXdr;
    },
    [state.publicKey],
  );

  return { ...state, connect, disconnect, signXdr };
}
