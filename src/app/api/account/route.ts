import type { NextRequest } from 'next/server';
import { requireWallet } from '@/server/lib/auth-guard';
import { fromError, ok } from '@/server/lib/http';
import { getAccountInfo } from '@/server/stellar';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const wallet = await requireWallet(req);
    const info = await getAccountInfo(wallet);
    return ok({ publicKey: wallet, ...info });
  } catch (err) {
    return fromError(err);
  }
}
