'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/ui/lib/api';

export type Account = {
  publicKey: string;
  exists: boolean;
  xlmBalance: string;
  usdcBalance: string;
  usdcTrustline: boolean;
};

export type Recipient = {
  id: string;
  label: string;
  address: string;
  asset: 'XLM' | 'USDC';
  weeklyAmount: string;
  createdAt: string;
};

export type PocketAllowance = {
  recipientId: string;
  label: string;
  address: string;
  allowance: string;
};

export type Claimable = {
  recipientId: string;
  label: string;
  parentAddress: string;
  claimable: string;
};

export type VaultEvent = {
  id: string;
  kind: string;
  label: string | null;
  amount: string;
  txHash: string;
  createdAt: string;
  direction: 'in' | 'out';
};

export type VaultState = {
  contractId: string;
  vault: { balance: string; allocated: string; unallocated: string };
  pockets: PocketAllowance[];
  claimable: Claimable[];
  events: VaultEvent[];
};

export function useFamilyData(publicKey: string | null) {
  const [account, setAccount] = useState<Account | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [vault, setVault] = useState<VaultState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) return;
    try {
      const [acc, recs, vlt] = await Promise.all([
        apiGet<Account>('/api/account'),
        apiGet<Recipient[]>('/api/recipients'),
        apiGet<VaultState>('/api/vault'),
      ]);
      setAccount(acc);
      setRecipients(recs);
      setVault(vlt);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey) return;
    setLoading(true);
    void refresh();
  }, [publicKey, refresh]);

  const allowanceFor = useCallback(
    (recipientId: string): string =>
      vault?.pockets.find((p) => p.recipientId === recipientId)?.allowance ?? '0',
    [vault],
  );

  return { account, recipients, vault, allowanceFor, loading, error, refresh };
}
