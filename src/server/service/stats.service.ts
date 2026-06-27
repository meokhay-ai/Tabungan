import { and, desc, isNull, notInArray, sql } from 'drizzle-orm';
import { demoExcludeKeys } from '@/server/config/env';
import { db } from '@/server/db/client';
import { recipients, sessions, vaultEvents } from '@/server/db/schema';

export type PublicStats = {
  uniqueWallets: number;
  logins: number;
  pockets: number;
  onchainActions: number;
  xlmDeposited: string;
  xlmClaimed: string;
  recent: Array<{
    label: string;
    kind: string;
    amount: string;
    txHash: string;
    createdAt: string;
  }>;
};

/**
 * Real interaction metrics. There is NO seeded data in this app: every count is
 * produced by a genuine wallet flow or a confirmed FamilyVault contract action.
 * `demoExcludeKeys` (env DEMO_EXCLUDE_KEYS, empty by default) lets an operator
 * drop a known automation/demo key from the totals.
 */
export const statsService = {
  async getPublic(): Promise<PublicStats> {
    const excl = demoExcludeKeys;
    const sessionWhere = excl.length ? notInArray(sessions.publicKey, excl) : undefined;
    const recipientWhere = and(
      isNull(recipients.archivedAt),
      excl.length ? notInArray(recipients.ownerPublicKey, excl) : undefined,
    );
    const eventWhere = excl.length ? notInArray(vaultEvents.ownerPublicKey, excl) : undefined;

    const [walletRow] = await db
      .select({
        unique: sql<number>`COUNT(DISTINCT ${sessions.publicKey})`,
        logins: sql<number>`COUNT(*)`,
      })
      .from(sessions)
      .where(sessionWhere);

    const [pocketRow] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(recipients)
      .where(recipientWhere);

    const [eventRow] = await db
      .select({
        n: sql<number>`COUNT(*)`,
        deposited: sql<string>`COALESCE(SUM(CASE WHEN ${vaultEvents.kind} = 'deposit' THEN ${vaultEvents.amount}::numeric ELSE 0 END), 0)`,
        claimed: sql<string>`COALESCE(SUM(CASE WHEN ${vaultEvents.kind} = 'claim' THEN ${vaultEvents.amount}::numeric ELSE 0 END), 0)`,
      })
      .from(vaultEvents)
      .where(eventWhere);

    const recentRows = await db
      .select({
        label: vaultEvents.recipientLabel,
        kind: vaultEvents.kind,
        amount: vaultEvents.amount,
        txHash: vaultEvents.txHash,
        createdAt: vaultEvents.createdAt,
      })
      .from(vaultEvents)
      .where(eventWhere)
      .orderBy(desc(vaultEvents.createdAt))
      .limit(6);

    return {
      uniqueWallets: Number(walletRow?.unique ?? 0),
      logins: Number(walletRow?.logins ?? 0),
      pockets: Number(pocketRow?.n ?? 0),
      onchainActions: Number(eventRow?.n ?? 0),
      xlmDeposited: String(eventRow?.deposited ?? '0'),
      xlmClaimed: String(eventRow?.claimed ?? '0'),
      recent: recentRows.map((r) => ({
        label: r.label ?? labelForKind(r.kind),
        kind: r.kind,
        amount: r.amount,
        txHash: r.txHash,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  },
};

function labelForKind(kind: string): string {
  switch (kind) {
    case 'deposit':
      return 'Vault deposit';
    case 'withdraw':
      return 'Unallocated withdrawal';
    case 'claim':
      return 'Allowance claim';
    default:
      return 'Allowance update';
  }
}
