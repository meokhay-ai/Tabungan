'use client';

import { ArrowRight, Coins, ShieldCheck, Sprout, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/ui/components/ui';
import { useWallet } from '@/ui/components/wallet-provider';

const STEPS = [
  {
    icon: Wallet,
    title: 'Connect & fund your vault',
    body: 'Sign a one-time challenge with Freighter, then deposit XLM into the FamilyVault Soroban contract. We pin the signature to Stellar testnet, so it works even if your wallet sits on mainnet.',
  },
  {
    icon: Sprout,
    title: 'Allocate allowances',
    body: 'Add a pocket for each kid or person you support, then set their allowance. The contract reserves that XLM on-chain — never more than you deposited.',
  },
  {
    icon: Coins,
    title: 'They claim on-chain',
    body: 'Recipients pull their allowance straight from the contract with their own wallet. You can top up, adjust, or withdraw the unallocated remainder anytime. Every action has a verifiable tx hash.',
  },
];

export function Landing() {
  const { connect, connecting, freighterLoading } = useWallet();

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <section className="tab-rise grid items-center gap-10 pt-12 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-honey-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-honey-ink)]">
            <Sprout className="h-3.5 w-3.5" />
            Stellar testnet · XLM &amp; USDC
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] text-[var(--color-ink)] sm:text-5xl">
            A family allowance vault
            <span className="text-[var(--color-brand)]"> that lives on-chain.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--color-ink-soft)]">
            Tabungan locks your XLM in a Soroban smart contract, lets you allocate a per-recipient
            allowance, and lets each recipient claim their own share — no middleman holds the money,
            and every balance is verifiable on Stellar.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void connect()}
              loading={connecting || freighterLoading}
              className="px-6 py-3 text-base"
            >
              <Wallet className="h-5 w-5" />
              Connect wallet to start
            </Button>
            <Link
              href="/stats"
              className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-semibold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            >
              See live activity
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-4 inline-flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
            <ShieldCheck className="h-4 w-4 text-[var(--color-brand)]" />
            Trust-minimized — funds live in the Soroban contract, never on our servers, and your
            secret key never leaves your browser.
          </p>
        </div>

        <div className="tab-card relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--color-brand-soft)] opacity-60" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
              Example pocket
            </p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="font-display text-2xl font-semibold text-[var(--color-ink)]">
                  Weekend pocket
                </p>
                <p className="font-mono text-xs text-[var(--color-ink-soft)]">GABC…7K2P</p>
              </div>
              <span className="rounded-[var(--radius-pill)] bg-[var(--color-brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-ink)]">
                XLM
              </span>
            </div>
            <div className="mt-5 rounded-2xl bg-[var(--color-bg-soft)] p-4">
              <p className="text-xs font-medium text-[var(--color-ink-soft)]">
                Allowance in the vault
              </p>
              <p className="font-display text-3xl font-semibold text-[var(--color-brand)]">5 XLM</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
                Reserved on-chain, claimable anytime
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-[var(--color-ink-soft)]">
              Illustration only — your real pockets appear after you connect.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
          How it works
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="tab-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand-ink)]">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="font-display text-sm font-semibold text-[var(--color-ink-soft)]">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-[var(--color-ink)]">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
