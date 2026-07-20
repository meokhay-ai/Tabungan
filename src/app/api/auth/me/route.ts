import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db } from '@/server/db/client';
import { sessions } from '@/server/db/schema';
import { readSessionCookie } from '@/server/lib/cookies';
import { fromError, ok } from '@/server/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionId = readSessionCookie(req);
    if (!sessionId) return ok({ publicKey: null });
    const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    if (!row || row.expiresAt.getTime() < Date.now()) return ok({ publicKey: null });
    return ok({ publicKey: row.publicKey });
  } catch (err) {
    return fromError(err);
  }
}
