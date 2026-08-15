import { lt } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { authNonces, sessions } from '@/server/db/schema';

export const cleanupService = {
  async removeExpiredSessions(): Promise<number> {
    const result = await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    return result.rowCount;
  },

  async removeExpiredAuthNonces(): Promise<number> {
    const result = await db.delete(authNonces).where(lt(authNonces.expiresAt, new Date()));
    return result.rowCount;
  },

  async removeConsumedAuthNonces(): Promise<number> {
    const result = await db
      .delete(authNonces)
      .where(lt(authNonces.expiresAt, new Date(Date.now() - 86400000)));
    return result.rowCount;
  },

  async runFullCleanup(): Promise<{ expiredSessions: number; expiredNonces: number }> {
    const expiredSessions = await this.removeExpiredSessions();
    const expiredNonces = await this.removeExpiredAuthNonces();
    return { expiredSessions, expiredNonces };
  },
};
