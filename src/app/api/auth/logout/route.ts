import type { NextRequest } from 'next/server';
import { clearSessionCookie, readSessionCookie } from '@/server/lib/cookies';
import { fromError, ok } from '@/server/lib/http';
import { authService } from '@/server/service/auth.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const sessionId = readSessionCookie(req);
    if (sessionId) await authService.destroy(sessionId);
    const res = ok({ ok: true });
    clearSessionCookie(res);
    return res;
  } catch (err) {
    return fromError(err);
  }
}
