'use client';

import { Dashboard } from '@/ui/components/dashboard';
import { Landing } from '@/ui/components/landing';
import { SiteFooter } from '@/ui/components/site-footer';
import { SiteHeader } from '@/ui/components/site-header';
import { Spinner } from '@/ui/components/ui';
import { useWallet, WalletProvider } from '@/ui/components/wallet-provider';

function HomeInner() {
  const { publicKey, sessionLoading } = useWallet();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">
        {sessionLoading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="flex items-center gap-3 text-[var(--color-ink-soft)]">
              <Spinner className="h-5 w-5 text-[var(--color-brand)]" />
              Loading your desk…
            </div>
          </div>
        ) : publicKey ? (
          <Dashboard />
        ) : (
          <Landing />
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

export function Home() {
  return (
    <WalletProvider>
      <HomeInner />
    </WalletProvider>
  );
}
