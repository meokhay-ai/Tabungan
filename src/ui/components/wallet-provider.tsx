'use client';

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useFreighter } from '@/ui/hooks/useFreighter';
import { useSession } from '@/ui/hooks/useSession';
import { apiPost } from '@/ui/lib/api';

type WalletCtx = {
  /** Authenticated wallet (session-backed) or null. */
  publicKey: string | null;
  sessionLoading: boolean;
  freighterAvailable: boolean;
  freighterLoading: boolean;
  connecting: boolean;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  signXdr: (xdr: string) => Promise<string>;
};

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const freighter = useFreighter();
  const { session, loading: sessionLoading, refresh, logout, setConnected } = useSession();
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async (): Promise<boolean> => {
    setConnecting(true);
    try {
      const address = freighter.publicKey ?? (await freighter.connect());
      if (!address) {
        toast.error(freighter.error ?? 'Could not reach Freighter');
        return false;
      }
      // SEP-10: challenge -> sign (network pinned to app) -> verify -> session.
      const { txXdr } = await apiPost<{ txXdr: string }>('/api/auth/challenge', {
        publicKey: address,
      });
      const signedTxXdr = await freighter.signXdr(txXdr, address);
      await apiPost('/api/auth/verify', { publicKey: address, signedTxXdr });
      setConnected(address);
      await refresh();
      toast.success('Wallet connected');
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection failed');
      return false;
    } finally {
      setConnecting(false);
    }
  }, [freighter, refresh, setConnected]);

  const disconnect = useCallback(async () => {
    await logout();
    freighter.disconnect();
    toast('Wallet disconnected');
  }, [logout, freighter]);

  const signXdr = useCallback((xdr: string) => freighter.signXdr(xdr), [freighter]);

  const value = useMemo<WalletCtx>(
    () => ({
      publicKey: session.publicKey,
      sessionLoading,
      freighterAvailable: freighter.isAvailable,
      freighterLoading: freighter.loading,
      connecting,
      connect,
      disconnect,
      signXdr,
    }),
    [
      session.publicKey,
      sessionLoading,
      freighter.isAvailable,
      freighter.loading,
      connecting,
      connect,
      disconnect,
      signXdr,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
