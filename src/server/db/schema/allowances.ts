import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** A confirmed on-chain allowance payment (real Horizon tx hash). */
export const allowances = pgTable('allowances', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerPublicKey: text('owner_public_key').notNull(),
  recipientId: uuid('recipient_id').notNull(),
  recipientLabel: text('recipient_label').notNull(),
  recipientAddress: text('recipient_address').notNull(),
  asset: text('asset').notNull(), // 'XLM' | 'USDC'
  amount: text('amount').notNull(), // decimal string, e.g. "5" or "1.5"
  txHash: text('tx_hash').notNull(),
  kind: text('kind').notNull().default('payment'), // 'payment' | 'create_account'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Allowance = typeof allowances.$inferSelect;
export type NewAllowance = typeof allowances.$inferInsert;
