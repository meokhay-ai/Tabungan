import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { BrandMark } from '@/ui/components/brand';

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-bg-soft)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-7 w-7" />
          <div>
            <p className="font-display text-sm font-semibold text-[var(--color-ink)]">Tabungan</p>
            <p className="text-xs text-[var(--color-ink-soft)]">
              Family allowance on Stellar testnet
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <Link
            href="/stats"
            className="font-semibold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            Live stats
          </Link>
          <a
            href="https://stellar.expert/explorer/testnet"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            Explorer
          </a>
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
            <ShieldCheck className="h-4 w-4 text-[var(--color-brand)]" />
            Non-custodial
          </span>
        </div>
      </div>
    </footer>
  );
}
