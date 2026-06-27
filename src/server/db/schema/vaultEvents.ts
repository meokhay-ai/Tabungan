import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * A confirmed FamilyVault contract action (real Soroban tx hash). Every row is
 * produced by a wallet-signed, RPC-confirmed contract invoke — never seeded.
 *
 * kind:
 *   deposit  — parent funded their on-chain vault
 *   allowance — parent set/adjusted a recipient's allowance
 *   claim    — recipient pulled XLM from their allowance
 *   withdraw — parent reclaimed unallocated XLM
 */
export const vaultEvents = pgTable('vault_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerPublicKey: text('owner_public_key').notNull(), // wallet that signed the action
  kind: text('kind').notNull(),
  parentAddress: text('parent_address').notNull(), // vault owner the action targets
  recipientId: uuid('recipient_id'),
  recipientLabel: text('recipient_label'),
  recipientAddress: text('recipient_address'),
  amount: text('amount').notNull(), // decimal XLM string, e.g. "5" or "1.5"
  txHash: text('tx_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type VaultEvent = typeof vaultEvents.$inferSelect;
export type NewVaultEvent = typeof vaultEvents.$inferInsert;
