import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getRateLimitKey } from '@/server/lib/rate-limit';
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

let recipientCreationAttempts = new Map<string, { count: number; resetAt: number }>();

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
    const clientIp = getRateLimitKey(req);
    const now = Date.now();
    const record = recipientCreationAttempts.get(clientIp);

    if (record && record.resetAt > now) {
      if (record.count >= 20) {
        return new Response('Too many recipient creation attempts', { status: 429 });
      }
      record.count++;
    } else {
      recipientCreationAttempts.set(clientIp, { count: 1, resetAt: now + 60000 });
    }

    const wallet = await requireWallet(req);
    const input = await parseJson(req, createSchema);
    return created(await recipientService.create(wallet, input));
  } catch (err) {
    return fromError(err);
  }
}
