import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireWallet } from '@/server/lib/auth-guard';
import { fromError, ok } from '@/server/lib/http';
import { amountSchema, assetSchema, parseJson } from '@/server/lib/validators';
import { vaultService } from '@/server/service/vault.service';

export const dynamic = 'force-dynamic';

const schema = z.object({
  action: z.enum(['deposit', 'allowance', 'withdraw', 'claim']),
  amount: amountSchema,
  recipientId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const wallet = await requireWallet(req);
    const input = await parseJson(req, schema);
    return ok(await vaultService.build(wallet, input));
  } catch (err) {
    return fromError(err);
  }
}
