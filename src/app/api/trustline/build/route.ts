import type { NextRequest } from 'next/server';
import { requireWallet } from '@/server/lib/auth-guard';
import { fromError, ok } from '@/server/lib/http';
import { buildUsdcTrustlineXdr } from '@/server/stellar';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const wallet = await requireWallet(req);
    return ok({ xdr: await buildUsdcTrustlineXdr(wallet) });
  } catch (err) {
    return fromError(err);
  }
}
