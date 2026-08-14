import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getRateLimitKey } from '@/server/lib/rate-limit';
import { setSessionCookie } from '@/server/lib/cookies';
import { fromError, ok } from '@/server/lib/http';
import { parseJson } from '@/server/lib/validators';
import { authService } from '@/server/service/auth.service';

export const dynamic = 'force-dynamic';

const schema = z.object({
  publicKey: z.string().min(1),
  signedTxXdr: z.string().min(1),
});

let verifyAttempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  try {
    const clientIp = getRateLimitKey(req);
    const now = Date.now();
    const record = verifyAttempts.get(clientIp);

    if (record && record.resetAt > now) {
      if (record.count >= 10) {
        return new Response('Too many verify attempts', { status: 429 });
      }
      record.count++;
    } else {
      verifyAttempts.set(clientIp, { count: 1, resetAt: now + 60000 });
    }

    const { publicKey, signedTxXdr } = await parseJson(req, schema);
    const { sessionId } = await authService.verify(publicKey, signedTxXdr);
    const res = ok({ publicKey });
    setSessionCookie(res, sessionId);
    return res;
  } catch (err) {
    return fromError(err);
  }
}
