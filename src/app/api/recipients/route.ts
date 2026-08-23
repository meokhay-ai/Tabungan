import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireWallet } from '@/server/lib/auth-guard';
import { created, fromError, ok } from '@/server/lib/http';
import { amountSchema, assetSchema, labelSchema, parseJson } from '@/server/lib/validators';
import { recipientService } from '@/server/service/recipient.service';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  label: labelSchema,
  address: z.string().min(1),
  asset: assetSchema.default('XLM'),
  weeklyAmount: amountSchema,
});

export async function GET(req: NextRequest) {
  try {
    const wallet = await requireWallet(req);
    return ok(await recipientService.list(wallet));
  } catch (err) {
    return fromError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const wallet = await requireWallet(req);
    const input = await parseJson(req, createSchema);
    return created(await recipientService.create(wallet, input));
  } catch (err) {
    return fromError(err);
  }
}
