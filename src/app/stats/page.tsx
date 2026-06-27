import type { Metadata } from 'next';
import { StatsView } from '@/ui/components/stats-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Live stats — Tabungan',
  description: 'Real wallet and allowance metrics from Tabungan on Stellar testnet.',
};

export default function StatsPage() {
  return <StatsView />;
}
