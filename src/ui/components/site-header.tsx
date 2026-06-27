'use client';

import { BarChart3, Check, Copy, LogOut, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Wordmark } from '@/ui/components/brand';
import { Button, Pill } from '@/ui/components/ui';
import { useWallet } from '@/ui/components/wallet-provider';
import { truncateAddress } from '@/ui/lib/format';

export function SiteHeader() {
  const { publicKey, connect, connecting, disconnect, freighterLoading } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const copy = async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0">
          <Wordmark />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Pill tone="muted">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
            Testnet
          </Pill>
          <Link
            href="/stats"
            className="hidden items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-sm font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-soft)] sm:inline-flex"
          >
            <BarChart3 className="h-4 w-4" />
            Stats
          </Link>

          {publicKey ? (
            <div className="relative" ref={ref}>
              <button
                data-testid="account-chip"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-1.5 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-brand)]"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-brand-soft)]">
                  <Wallet className="h-3 w-3 text-[var(--color-brand-ink)]" />
                </span>
                {truncateAddress(publicKey, 4, 4)}
              </button>
              {open && (
                <div className="tab-rise absolute right-0 mt-2 w-72 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-3 shadow-[var(--shadow-pop)]">
                  <p className="px-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
                    Connected wallet
                  </p>
                  <p className="mt-1 break-all rounded-lg bg-[var(--color-bg-soft)] p-2 font-mono text-xs text-[var(--color-ink)]">
                    {publicKey}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" className="flex-1 px-3 py-2 text-xs" onClick={copy}>
                      {copied ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1 px-3 py-2 text-xs"
                      onClick={() => {
                        setOpen(false);
                        void disconnect();
                      }}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button onClick={() => void connect()} loading={connecting || freighterLoading}>
              <Wallet className="h-4 w-4" />
              Connect
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
