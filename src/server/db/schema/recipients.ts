import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * A "pocket" — an allowance recipient owned by a connected family wallet.
 * label + Stellar address + preferred asset + a default weekly amount.
 * Created only by a real authenticated wallet; never seeded.
 */
export const recipients = pgTable('recipients', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerPublicKey: text('owner_public_key').notNull(),
  label: text('label').notNull(),
  address: text('address').notNull(),
  asset: text('asset').notNull().default('XLM'), // 'XLM' | 'USDC'
  weeklyAmount: text('weekly_amount').notNull().default('5'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

export type Recipient = typeof recipients.$inferSelect;
export type NewRecipient = typeof recipients.$inferInsert;
