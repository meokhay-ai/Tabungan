import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { recipients, type VaultEvent, vaultEvents } from '@/server/db/schema';
import { AppError } from '@/server/lib/http';
import {
  buildClaim,
  buildDeposit,
  buildSetAllowance,
  buildWithdraw,
  fromStroops,
  readAllowance,
  readVault,
  submitVaultXdr,
  toStroops,
} from '@/server/stellar';
import { recipientService } from './recipient.service';

export type VaultAction = 'deposit' | 'allowance' | 'withdraw' | 'claim';

type BuildInput = {
  action: VaultAction;
  amount: string;
  recipientId?: string;
};

type SubmitInput = BuildInput & { signedXdr: string };

export type PocketAllowance = {
  recipientId: string;
  label: string;
  address: string;
  allowance: string; // decimal XLM
};

export type Claimable = {
  recipientId: string;
  label: string;
  parentAddress: string;
  claimable: string; // decimal XLM
};

export type VaultStateDto = {
  contractId: string;
  vault: { balance: string; allocated: string; unallocated: string };
  pockets: PocketAllowance[];
  claimable: Claimable[];
  events: Array<{
    id: string;
    kind: string;
    label: string | null;
    amount: string;
    txHash: string;
    createdAt: string;
    direction: 'in' | 'out';
  }>;
};

/** Resolve the (parent, recipient, amount) for a write, validating ownership. */
async function resolveBuild(wallet: string, input: BuildInput) {
  const amount = toStroops(input.amount);
  if (amount <= 0n) throw new AppError('INVALID_INPUT', 'Enter an amount greater than zero', 400);

  switch (input.action) {
    case 'deposit':
      return { xdr: await buildDeposit(wallet, amount) };
    case 'withdraw':
      return { xdr: await buildWithdraw(wallet, amount) };
    case 'allowance': {
      if (!input.recipientId) throw new AppError('INVALID_INPUT', 'Missing pocket', 400);
      const r = await recipientService.get(wallet, input.recipientId);
      return { xdr: await buildSetAllowance(wallet, r.address, amount), label: r.label };
    }
    case 'claim': {
      if (!input.recipientId) throw new AppError('INVALID_INPUT', 'Missing pocket', 400);
      const r = await recipientService.getById(input.recipientId);
      if (r.address !== wallet) {
        throw new AppError('FORBIDDEN', 'This allowance is not addressed to your wallet', 403);
      }
      return { xdr: await buildClaim(r.ownerPublicKey, wallet, amount), label: r.label };
    }
    default:
      throw new AppError('INVALID_INPUT', 'Unknown vault action', 400);
  }
}

export const vaultService = {
  async build(wallet: string, input: BuildInput): Promise<{ xdr: string; label?: string }> {
    return resolveBuild(wallet, input);
  },

  /** Submit the signed invoke, confirm on-chain, then record the event. */
  async submit(wallet: string, input: SubmitInput): Promise<{ txHash: string }> {
    if (!input.signedXdr) throw new AppError('INVALID_INPUT', 'Missing signed transaction', 400);
    const { hash } = await submitVaultXdr(input.signedXdr);

    let parentAddress = wallet;
    let recipientId: string | null = null;
    let recipientLabel: string | null = null;
    let recipientAddress: string | null = null;

    if (input.action === 'allowance' && input.recipientId) {
      const r = await recipientService.get(wallet, input.recipientId);
      recipientId = r.id;
      recipientLabel = r.label;
      recipientAddress = r.address;
    } else if (input.action === 'claim' && input.recipientId) {
      const r = await recipientService.getById(input.recipientId);
      parentAddress = r.ownerPublicKey;
      recipientId = r.id;
      recipientLabel = r.label;
      recipientAddress = r.address;
    }

    const kindMap: Record<VaultAction, string> = {
      deposit: 'deposit',
      allowance: 'allowance',
      withdraw: 'withdraw',
      claim: 'claim',
    };

    await db.insert(vaultEvents).values({
      ownerPublicKey: wallet,
      kind: kindMap[input.action],
      parentAddress,
      recipientId,
      recipientLabel,
      recipientAddress,
      amount: input.amount,
      txHash: hash,
    });

    return { txHash: hash };
  },

  /** The connected wallet's full on-chain + activity state for the dashboard. */
  async getState(wallet: string): Promise<VaultStateDto> {
    const { stellar } = await import('@/server/config/stellar');

    let balance = 0n;
    let allocated = 0n;
    try {
      const v = await readVault(wallet);
      balance = v.balance;
      allocated = v.allocated;
    } catch {
      // Wallet unfunded / no vault yet — render the empty state.
    }

    const myPockets = await recipientService.list(wallet);
    const pockets: PocketAllowance[] = await Promise.all(
      myPockets.map(async (p) => {
        let allowance = 0n;
        try {
          allowance = await readAllowance(wallet, wallet, p.address);
        } catch {
          /* leave at zero */
        }
        return {
          recipientId: p.id,
          label: p.label,
          address: p.address,
          allowance: fromStroops(allowance),
        };
      }),
    );

    // Pockets ANY parent has addressed to this wallet → claimable to me.
    const addressedToMe = await db
      .select()
      .from(recipients)
      .where(and(eq(recipients.address, wallet), isNull(recipients.archivedAt)));
    const claimable: Claimable[] = [];
    for (const r of addressedToMe) {
      let amt = 0n;
      try {
        amt = await readAllowance(wallet, r.ownerPublicKey, wallet);
      } catch {
        /* skip */
      }
      if (amt > 0n) {
        claimable.push({
          recipientId: r.id,
          label: r.label,
          parentAddress: r.ownerPublicKey,
          claimable: fromStroops(amt),
        });
      }
    }

    const eventRows = await db
      .select()
      .from(vaultEvents)
      .where(or(eq(vaultEvents.ownerPublicKey, wallet), eq(vaultEvents.recipientAddress, wallet)))
      .orderBy(desc(vaultEvents.createdAt))
      .limit(20);

    return {
      contractId: stellar.contractId,
      vault: {
        balance: fromStroops(balance),
        allocated: fromStroops(allocated),
        unallocated: fromStroops(balance - allocated),
      },
      pockets,
      claimable,
      events: eventRows.map((e: VaultEvent) => ({
        id: e.id,
        kind: e.kind,
        label: e.recipientLabel,
        amount: e.amount,
        txHash: e.txHash,
        createdAt: e.createdAt.toISOString(),
        direction: e.kind === 'claim' || e.kind === 'withdraw' ? 'in' : 'out',
      })),
    };
  },
};
