import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db } from '@/server/db/client';
import { sessions } from '@/server/db/schema';
import { readSessionCookie } from './cookies';
import { AppError } from './http';

/** Resolve the authenticated wallet from the session cookie, or throw 401. */
export async function requireWallet(req: NextRequest): Promise<string> {
  const sessionId = readSessionCookie(req);
  if (!sessionId) throw new AppError('UNAUTHORIZED', 'Connect your wallet to continue', 401);
  const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!row) throw new AppError('UNAUTHORIZED', 'Session not found — reconnect your wallet', 401);
  if (row.expiresAt.getTime() < Date.now()) {
    throw new AppError('UNAUTHORIZED', 'Session expired — reconnect your wallet', 401);
  }
  return row.publicKey;
}
