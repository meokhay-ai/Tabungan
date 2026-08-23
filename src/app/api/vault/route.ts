import type { NextRequest } from 'next/server';
import { requireWallet } from '@/server/lib/auth-guard';
import { fromError, ok } from '@/server/lib/http';
import { vaultService } from '@/server/service/vault.service';

export const dynamic = 'force-dynamic';
// Reading the vault, every pocket allowance and claimable balances makes several
// Soroban RPC simulations — give it room beyond Vercel's 10s default.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const wallet = await requireWallet(req);
    return ok(await vaultService.getState(wallet));
  } catch (err) {
    return fromError(err);
  }
}
