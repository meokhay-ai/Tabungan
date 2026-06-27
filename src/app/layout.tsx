import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['opsz'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'),
  title: 'Tabungan — Family allowance, on-chain',
  description:
    'Tabungan turns your Stellar wallet into a family allowance desk. Add a pocket for each kid, then send real testnet allowances in XLM or USDC — every payment is a verifiable on-chain transaction.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Tabungan — Family allowance, on-chain',
    description: 'Send real Stellar allowances to the people you look after.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${fraunces.variable}`}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--color-card)',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-line)',
            },
          }}
        />
      </body>
    </html>
  );
}
