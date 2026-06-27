'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { apiGet, apiPost } from '@/ui/lib/api';

type Session = { publicKey: string | null };
type Snapshot = { session: Session; loading: boolean };

let state: Snapshot = { session: { publicKey: null }, loading: true };
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

function emit() {
  for (const l of listeners) l();
}
function setState(next: Snapshot) {
  state = next;
  emit();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return state;
}
const SSR_SNAPSHOT: Snapshot = Object.freeze({
  session: Object.freeze({ publicKey: null }) as Session,
  loading: true,
}) as Snapshot;
function getServerSnapshot() {
  return SSR_SNAPSHOT;
}

async function fetchSession(): Promise<void> {
  try {
    const data = await apiGet<{ publicKey: string | null }>('/api/auth/me');
    setState({ session: { publicKey: data.publicKey }, loading: false });
  } catch {
    setState({ session: { publicKey: null }, loading: false });
  } finally {
    inFlight = null;
  }
}

export function useSession() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const refresh = useCallback(async () => {
    inFlight = fetchSession();
    return inFlight;
  }, []);

  useEffect(() => {
    if (state.loading && !inFlight) inFlight = fetchSession();
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/auth/logout');
    } finally {
      setState({ session: { publicKey: null }, loading: false });
    }
  }, []);

  const setConnected = useCallback((publicKey: string) => {
    setState({ session: { publicKey }, loading: false });
  }, []);

  return { session: snap.session, loading: snap.loading, refresh, logout, setConnected };
}
