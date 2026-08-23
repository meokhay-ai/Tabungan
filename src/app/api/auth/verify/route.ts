import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { setSessionCookie } from '@/server/lib/cookies';
import { fromError, ok } from '@/server/lib/http';
import { parseJson } from '@/server/lib/validators';
import { authService } from '@/server/service/auth.service';

export const dynamic = 'force-dynamic';

const schema = z.object({
  publicKey: z.string().min(1),
  signedTxXdr: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { publicKey, signedTxXdr } = await parseJson(req, schema);
    const { sessionId } = await authService.verify(publicKey, signedTxXdr);
    const res = ok({ publicKey });
    setSessionCookie(res, sessionId);
    return res;
  } catch (err) {
    return fromError(err);
  }
}
