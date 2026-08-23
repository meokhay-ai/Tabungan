import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireWallet } from '@/server/lib/auth-guard';
import { fromError, ok } from '@/server/lib/http';
import { parseJson } from '@/server/lib/validators';
import { submitSignedXdr } from '@/server/stellar';

export const dynamic = 'force-dynamic';

const schema = z.object({ signedXdr: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    await requireWallet(req);
    const { signedXdr } = await parseJson(req, schema);
    return ok({ txHash: await submitSignedXdr(signedXdr) });
  } catch (err) {
    return fromError(err);
  }
}
