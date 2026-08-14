import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { fromError, ok } from '@/server/lib/http';
import { parseJson } from '@/server/lib/validators';
import { submitSignedXdr } from '@/server/stellar';

export const dynamic = 'force-dynamic';

const schema = z.object({
  signedXdr: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { signedXdr } = await parseJson(req, schema);
    const txHash = await submitSignedXdr(signedXdr);
    return ok({ txHash });
  } catch (err) {
    return fromError(err);
  }
}
