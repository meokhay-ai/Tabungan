import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getRateLimitKey } from '@/server/lib/rate-limit';
import { fromError, ok } from '@/server/lib/http';
import { parseJson } from '@/server/lib/validators';
import { authService } from '@/server/service/auth.service';

export const dynamic = 'force-dynamic';

const schema = z.object({ publicKey: z.string().min(1) });

let challengeAttempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  try {
    const clientIp = getRateLimitKey(req);
    const now = Date.now();
    const record = challengeAttempts.get(clientIp);

    if (record && record.resetAt > now) {
      if (record.count >= 10) {
        return new Response('Too many challenge requests', { status: 429 });
      }
      record.count++;
    } else {
      challengeAttempts.set(clientIp, { count: 1, resetAt: now + 60000 });
    }

    const { publicKey } = await parseJson(req, schema);
    const data = await authService.createChallenge(publicKey);
    return ok(data);
  } catch (err) {
    return fromError(err);
  }
}
