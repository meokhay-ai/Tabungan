import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { type Recipient, recipients } from '@/server/db/schema';
import { AppError } from '@/server/lib/http';
import { isValidAddress } from '@/server/stellar';

export const recipientService = {
  async list(ownerPublicKey: string): Promise<Recipient[]> {
    return db
      .select()
      .from(recipients)
      .where(and(eq(recipients.ownerPublicKey, ownerPublicKey), isNull(recipients.archivedAt)))
      .orderBy(desc(recipients.createdAt));
  },

  async get(ownerPublicKey: string, id: string): Promise<Recipient> {
    const [row] = await db.select().from(recipients).where(eq(recipients.id, id)).limit(1);
    if (!row || row.ownerPublicKey !== ownerPublicKey) {
      throw new AppError('NOT_FOUND', 'Pocket not found', 404);
    }
    return row;
  },

  /** Fetch a pocket by id WITHOUT an owner check — used by the claim flow,
   * where the caller is the recipient, not the parent who created it. */
  async getById(id: string): Promise<Recipient> {
    const [row] = await db.select().from(recipients).where(eq(recipients.id, id)).limit(1);
    if (!row) throw new AppError('NOT_FOUND', 'Pocket not found', 404);
    return row;
  },

  async create(
    ownerPublicKey: string,
    input: { label: string; address: string; asset: 'XLM' | 'USDC'; weeklyAmount: string },
  ): Promise<Recipient> {
    if (!isValidAddress(input.address)) {
      throw new AppError('INVALID_INPUT', 'That is not a valid Stellar address', 400);
    }
    const existing = await db
      .select({ id: recipients.id })
      .from(recipients)
      .where(
        and(
          eq(recipients.ownerPublicKey, ownerPublicKey),
          eq(recipients.address, input.address),
          isNull(recipients.archivedAt),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      throw new AppError('ALREADY_EXISTS', 'You already added a pocket for this address', 409);
    }
    const [row] = await db
      .insert(recipients)
      .values({
        ownerPublicKey,
        label: input.label.trim(),
        address: input.address,
        asset: input.asset,
        weeklyAmount: input.weeklyAmount,
      })
      .returning();
    return row;
  },

  async archive(ownerPublicKey: string, id: string): Promise<void> {
    const row = await this.get(ownerPublicKey, id);
    await db.update(recipients).set({ archivedAt: new Date() }).where(eq(recipients.id, row.id));
  },
};
