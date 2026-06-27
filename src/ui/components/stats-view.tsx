'use client';

import {
  ArrowLeft,
  ArrowUpRight,
  Coins,
  ExternalLink,
  HandCoins,
  Users,
  Vault,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BrandMark } from '@/ui/components/brand';
import { Pill, Spinner } from '@/ui/components/ui';
import { apiGet } from '@/ui/lib/api';
import { explorerTxUrl, fmtAmount, timeAgo, truncateAddress } from '@/ui/lib/format';

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';

const KIND_LABEL: Record<string, string> = {
  deposit: 'Deposited to vault',
  allowance: 'Allowance set',
  claim: 'Allowance claimed',
  withdraw: 'Unallocated withdrawn',
};

type Stats = {
  uniqueWallets: number;
  logins: number;
  pockets: number;
  onchainActions: number;
  xlmDeposited: string;
  xlmClaimed: string;
  recent: Array<{
    label: string;
    kind: string;
    amount: string;
    txHash: string;
    createdAt: string;
  }>;
};

export function StatsView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Stats>('/api/stats')
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load stats'));
  }, []);

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-lg font-semibold text-[var(--color-ink)]">
              Tabungan
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-sm font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-soft)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to desk
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="tab-rise">
          <Pill tone="brand">Live · real on-chain activity</Pill>
          <h1 className="mt-4 font-display text-3xl font-semibold text-[var(--color-ink)] sm:text-4xl">
            Every number here is real
          </h1>
          <p className="mt-2 max-w-2xl text-[var(--color-ink-soft)]">
            Tabungan ships with zero seeded data. These counts come straight from wallets that
            connected and FamilyVault contract actions that actually settled on Stellar testnet.
          </p>
        </div>

        {error ? (
          <p className="mt-8 rounded-xl bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : !stats ? (
          <div className="mt-10 flex items-center gap-3 text-[var(--color-ink-soft)]">
            <Spinner className="h-5 w-5 text-[var(--color-brand)]" />
            Loading live metrics…
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={Users} label="Unique wallets" value={stats.uniqueWallets} />
              <Stat icon={Wallet} label="Wallet logins" value={stats.logins} />
              <Stat icon={Coins} label="Pockets created" value={stats.pockets} />
              <Stat icon={Vault} label="On-chain actions" value={stats.onchainActions} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="tab-card p-5">
                <p className="text-xs font-medium text-[var(--color-ink-soft)]">
                  Total XLM deposited to vaults
                </p>
                <p className="mt-1 font-display text-3xl font-semibold text-[var(--color-brand)]">
                  {fmtAmount(stats.xlmDeposited, 'XLM')}
                </p>
              </div>
              <div className="tab-card p-5">
                <p className="text-xs font-medium text-[var(--color-ink-soft)]">
                  Total XLM claimed by recipients
                </p>
                <p className="mt-1 font-display text-3xl font-semibold text-[var(--color-honey)]">
                  {fmtAmount(stats.xlmClaimed, 'XLM')}
                </p>
              </div>
            </div>

            <h2 className="mt-10 font-display text-xl font-semibold text-[var(--color-ink)]">
              Latest contract activity
            </h2>
            <div className="tab-card mt-4 divide-y divide-[var(--color-line)]">
              {stats.recent.length === 0 ? (
                <p className="p-8 text-center text-sm text-[var(--color-ink-soft)]">
                  No contract activity yet — be the first to connect and fund a vault.
                </p>
              ) : (
                stats.recent.map((r) => (
                  <div key={r.txHash} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-soft)]">
                        {r.kind === 'claim' ? (
                          <HandCoins className="h-4 w-4 text-[var(--color-brand-ink)]" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-[var(--color-brand-ink)]" />
                        )}
                      </span>
                      <div>
                        <p className="font-semibold text-[var(--color-ink)]">
                          {KIND_LABEL[r.kind] ?? 'Vault action'}
                          {r.label ? ` · ${r.label}` : ''}
                        </p>
                        <p className="text-xs text-[var(--color-ink-soft)]">
                          {timeAgo(r.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-semibold text-[var(--color-brand)]">
                        {fmtAmount(r.amount, 'XLM')}
                      </p>
                      <a
                        href={explorerTxUrl(r.txHash, NETWORK)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-brand)]"
                      >
                        {truncateAddress(r.txHash, 4, 4)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="tab-card p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-soft)]">
        <Icon className="h-5 w-5 text-[var(--color-brand-ink)]" />
      </span>
      <p className="mt-3 font-display text-3xl font-semibold text-[var(--color-ink)]">{value}</p>
      <p className="text-xs font-medium text-[var(--color-ink-soft)]">{label}</p>
    </div>
  );
}
