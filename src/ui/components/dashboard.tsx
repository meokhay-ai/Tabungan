'use client';

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  ExternalLink,
  HandCoins,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Vault as VaultIcon,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Field, inputClass, Modal, Pill, Spinner } from '@/ui/components/ui';
import { useWallet } from '@/ui/components/wallet-provider';
import {
  type Claimable,
  type Recipient,
  useFamilyData,
  type VaultState,
} from '@/ui/hooks/useFamilyData';
import { apiDelete, apiPost } from '@/ui/lib/api';
import {
  explorerAccountUrl,
  explorerContractUrl,
  explorerTxUrl,
  fmtAmount,
  timeAgo,
  truncateAddress,
} from '@/ui/lib/format';

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';

type VaultAction = 'deposit' | 'allowance' | 'withdraw' | 'claim';

/** One build → sign → submit pass against the FamilyVault contract. */
async function attemptVaultAction(
  signXdr: (xdr: string) => Promise<string>,
  action: VaultAction,
  amount: string,
  recipientId?: string,
): Promise<string> {
  const built = await apiPost<{ xdr: string; label?: string }>('/api/vault/build', {
    action,
    amount,
    recipientId,
  });
  const signed = await signXdr(built.xdr);
  const res = await apiPost<{ txHash: string }>('/api/vault/submit', {
    action,
    amount,
    recipientId,
    signedXdr: signed,
  });
  return res.txHash;
}

/**
 * Build → sign → submit a FamilyVault invoke, returning the tx hash. If the
 * first attempt fails to confirm (e.g. the RPC briefly served a stale account
 * sequence right after the previous tx), we rebuild against a fresh sequence
 * and try once more — so consecutive actions don't get stuck on transient lag.
 */
async function runVaultAction(
  signXdr: (xdr: string) => Promise<string>,
  action: VaultAction,
  amount: string,
  recipientId?: string,
): Promise<string> {
  try {
    return await attemptVaultAction(signXdr, action, amount, recipientId);
  } catch (first) {
    await new Promise((r) => setTimeout(r, 4000));
    try {
      return await attemptVaultAction(signXdr, action, amount, recipientId);
    } catch {
      throw first;
    }
  }
}

export function Dashboard() {
  const { publicKey, signXdr } = useWallet();
  const { account, recipients, vault, allowanceFor, loading, refresh } = useFamilyData(publicKey);
  const [addOpen, setAddOpen] = useState(false);
  const [allowanceTarget, setAllowanceTarget] = useState<Recipient | null>(null);
  const [claimTarget, setClaimTarget] = useState<Claimable | null>(null);
  const [moveOpen, setMoveOpen] = useState<null | 'deposit' | 'withdraw'>(null);
  const [enablingUsdc, setEnablingUsdc] = useState(false);

  const enableUsdc = async () => {
    setEnablingUsdc(true);
    try {
      const { xdr } = await apiPost<{ xdr: string }>('/api/trustline/build');
      const signed = await signXdr(xdr);
      const { txHash } = await apiPost<{ txHash: string }>('/api/trustline/submit', {
        signedXdr: signed,
      });
      toast.success('USDC enabled on your wallet', {
        description: `Trustline tx ${truncateAddress(txHash, 6, 6)}`,
      });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not enable USDC');
    } finally {
      setEnablingUsdc(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-6 sm:px-6">
      <VaultPanel
        vault={vault}
        loading={loading}
        onDeposit={() => setMoveOpen('deposit')}
        onWithdraw={() => setMoveOpen('withdraw')}
      />

      <WalletStrip
        account={account}
        loading={loading}
        onEnableUsdc={enableUsdc}
        enabling={enablingUsdc}
      />

      {vault && vault.claimable.length > 0 && (
        <ClaimableSection claimable={vault.claimable} onClaim={setClaimTarget} />
      )}

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Pockets</h2>
            <p className="text-sm text-[var(--color-ink-soft)]">
              Each pocket is a recipient. Allocate them an allowance from your vault; they claim it
              on-chain.
            </p>
          </div>
          {recipients.length > 0 && (
            <Button variant="secondary" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add pocket
            </Button>
          )}
        </div>

        {loading ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="tab-card p-5">
                <div className="tab-skeleton h-5 w-32" />
                <div className="tab-skeleton mt-3 h-4 w-24" />
                <div className="tab-skeleton mt-6 h-10 w-full" />
              </div>
            ))}
          </div>
        ) : recipients.length === 0 ? (
          <EmptyPockets onAdd={() => setAddOpen(true)} />
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {recipients.map((r) => (
              <PocketCard
                key={r.id}
                recipient={r}
                allowance={allowanceFor(r.id)}
                onSetAllowance={() => setAllowanceTarget(r)}
                onArchived={refresh}
              />
            ))}
          </div>
        )}
      </section>

      <Activity vault={vault} loading={loading} />

      <AddPocketModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={refresh} />
      <MoveModal
        mode={moveOpen}
        vault={vault}
        account={account}
        onClose={() => setMoveOpen(null)}
        onDone={refresh}
      />
      <SetAllowanceModal
        recipient={allowanceTarget}
        vault={vault}
        currentAllowance={allowanceTarget ? allowanceFor(allowanceTarget.id) : '0'}
        onClose={() => setAllowanceTarget(null)}
        onDone={refresh}
      />
      <ClaimModal target={claimTarget} onClose={() => setClaimTarget(null)} onDone={refresh} />
    </main>
  );
}

function VaultPanel({
  vault,
  loading,
  onDeposit,
  onWithdraw,
}: {
  vault: VaultState | null;
  loading: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const v = vault?.vault;
  const empty = !loading && v && Number(v.balance) === 0;
  return (
    <section className="tab-card overflow-hidden p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-brand-soft)]">
            <VaultIcon className="h-5 w-5 text-[var(--color-brand-ink)]" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
              On-chain family vault
            </p>
            {vault ? (
              <a
                href={explorerContractUrl(vault.contractId, NETWORK)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-sm text-[var(--color-ink)] hover:text-[var(--color-brand)]"
              >
                {truncateAddress(vault.contractId, 6, 6)}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <div className="tab-skeleton mt-1 h-4 w-28" />
            )}
          </div>
        </div>
        <Pill tone="brand">
          <ShieldCheck className="h-3.5 w-3.5" />
          Soroban · XLM
        </Pill>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <VaultTile
          label="In vault"
          value={loading || !v ? null : fmtAmount(v.balance, 'XLM')}
          tone="brand"
        />
        <VaultTile
          label="Allocated"
          value={loading || !v ? null : fmtAmount(v.allocated, 'XLM')}
          tone="honey"
        />
        <VaultTile
          label="Free to allocate"
          value={loading || !v ? null : fmtAmount(v.unallocated, 'XLM')}
          tone="brand"
        />
      </div>

      {empty && (
        <p className="mt-4 rounded-xl bg-[var(--color-brand-soft)] px-4 py-3 text-sm text-[var(--color-brand-ink)]">
          Your vault is empty. Deposit XLM to start — the contract custodies it until you allocate
          allowances and recipients claim.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={onDeposit} className="px-6 py-3">
          <ArrowDownToLine className="h-4 w-4" />
          Deposit XLM
        </Button>
        <Button
          variant="secondary"
          onClick={onWithdraw}
          disabled={!v || Number(v.unallocated) === 0}
        >
          <ArrowUpFromLine className="h-4 w-4" />
          Withdraw unallocated
        </Button>
      </div>
    </section>
  );
}

function VaultTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | null;
  tone: 'brand' | 'honey';
}) {
  const color = tone === 'brand' ? 'text-[var(--color-brand)]' : 'text-[var(--color-honey)]';
  return (
    <div className="rounded-2xl bg-[var(--color-bg-soft)] p-5">
      <p className="text-xs font-medium text-[var(--color-ink-soft)]">{label}</p>
      {value === null ? (
        <div className="tab-skeleton mt-2 h-8 w-28" />
      ) : (
        <p className={`mt-1 font-display text-2xl font-semibold ${color}`}>{value}</p>
      )}
    </div>
  );
}

function WalletStrip({
  account,
  loading,
  onEnableUsdc,
  enabling,
}: {
  account: ReturnType<typeof useFamilyData>['account'];
  loading: boolean;
  onEnableUsdc: () => void;
  enabling: boolean;
}) {
  return (
    <section className="tab-card mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-bg-soft)]">
          <Wallet className="h-5 w-5 text-[var(--color-ink-soft)]" />
        </span>
        <div>
          <p className="text-xs font-medium text-[var(--color-ink-soft)]">Your wallet</p>
          {account ? (
            <a
              href={explorerAccountUrl(account.publicKey, NETWORK)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-sm text-[var(--color-ink)] hover:text-[var(--color-brand)]"
            >
              {truncateAddress(account.publicKey, 6, 6)}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <div className="tab-skeleton mt-1 h-4 w-24" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-5">
        <div className="text-right">
          <p className="text-xs text-[var(--color-ink-soft)]">XLM balance</p>
          {loading || !account ? (
            <div className="tab-skeleton mt-1 h-5 w-20" />
          ) : (
            <p className="font-display text-lg font-semibold text-[var(--color-ink)]">
              {fmtAmount(account.xlmBalance, 'XLM')}
            </p>
          )}
        </div>
        {account && !account.usdcTrustline ? (
          <Button variant="honey" onClick={onEnableUsdc} loading={enabling}>
            <Coins className="h-4 w-4" />
            Enable USDC
          </Button>
        ) : account?.usdcTrustline ? (
          <Pill tone="honey">USDC enabled</Pill>
        ) : null}
      </div>
    </section>
  );
}

function ClaimableSection({
  claimable,
  onClaim,
}: {
  claimable: Claimable[];
  onClaim: (c: Claimable) => void;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
        Ready to claim
      </h2>
      <p className="text-sm text-[var(--color-ink-soft)]">
        Allowances another wallet allocated to you. Claim pulls the XLM straight from the contract.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {claimable.map((c) => (
          <div key={c.recipientId} className="tab-card flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold text-[var(--color-ink)]">
                  {c.label}
                </p>
                <p className="font-mono text-xs text-[var(--color-ink-soft)]">
                  from {truncateAddress(c.parentAddress, 6, 6)}
                </p>
              </div>
              <Pill tone="brand">Claimable</Pill>
            </div>
            <div className="mt-4 rounded-xl bg-[var(--color-brand-soft)] px-4 py-3">
              <p className="text-xs text-[var(--color-brand-ink)]">You can claim</p>
              <p className="font-display text-xl font-semibold text-[var(--color-brand)]">
                {fmtAmount(c.claimable, 'XLM')}
              </p>
            </div>
            <Button className="mt-4" onClick={() => onClaim(c)}>
              <HandCoins className="h-4 w-4" />
              Claim allowance
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyPockets({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="tab-card mt-5 flex flex-col items-center gap-4 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-brand-soft)]">
        <Sparkles className="h-6 w-6 text-[var(--color-brand-ink)]" />
      </span>
      <div>
        <h3 className="font-display text-xl font-semibold text-[var(--color-ink)]">
          No pockets yet
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-ink-soft)]">
          Add a pocket for each recipient — a friendly name and their Stellar address. Then allocate
          them an allowance from your vault.
        </p>
      </div>
      <Button onClick={onAdd} className="px-6 py-3">
        <Plus className="h-4 w-4" />
        Add your first pocket
      </Button>
    </div>
  );
}

function PocketCard({
  recipient,
  allowance,
  onSetAllowance,
  onArchived,
}: {
  recipient: Recipient;
  allowance: string;
  onSetAllowance: () => void;
  onArchived: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const remove = async () => {
    setRemoving(true);
    try {
      await apiDelete(`/api/recipients/${recipient.id}`);
      toast('Pocket removed');
      onArchived();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove pocket');
      setRemoving(false);
    }
  };
  const has = Number(allowance) > 0;
  return (
    <div className="tab-card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-[var(--color-ink)]">
            {recipient.label}
          </p>
          <a
            href={explorerAccountUrl(recipient.address, NETWORK)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-brand)]"
          >
            {truncateAddress(recipient.address, 6, 6)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <Pill tone={has ? 'brand' : 'muted'}>{has ? 'Funded' : 'No allowance'}</Pill>
      </div>

      <div className="mt-4 rounded-xl bg-[var(--color-bg-soft)] px-4 py-3">
        <p className="text-xs text-[var(--color-ink-soft)]">Current on-chain allowance</p>
        <p className="font-display text-xl font-semibold text-[var(--color-ink)]">
          {fmtAmount(allowance, 'XLM')}
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={onSetAllowance}>
          <Coins className="h-4 w-4" />
          Set allowance
        </Button>
        <Button
          variant="ghost"
          onClick={remove}
          loading={removing}
          aria-label="Remove pocket"
          className="px-3"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const KIND_COPY: Record<string, string> = {
  deposit: 'Deposited to vault',
  allowance: 'Allowance set',
  claim: 'Allowance claimed',
  withdraw: 'Unallocated withdrawn',
};

function Activity({ vault, loading }: { vault: VaultState | null; loading: boolean }) {
  const events = vault?.events ?? [];
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
        On-chain activity
      </h2>
      <div className="tab-card mt-5 divide-y divide-[var(--color-line)]">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div className="tab-skeleton h-4 w-40" />
              <div className="tab-skeleton h-4 w-20" />
            </div>
          ))
        ) : events.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--color-ink-soft)]">
            No contract activity yet. Deposits, allowances and claims appear here with a verifiable
            Soroban receipt.
          </p>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    e.direction === 'in'
                      ? 'bg-[var(--color-honey-soft)]'
                      : 'bg-[var(--color-brand-soft)]'
                  }`}
                >
                  {e.direction === 'in' ? (
                    <ArrowDownToLine className="h-4 w-4 text-[var(--color-honey-ink)]" />
                  ) : (
                    <ArrowUpFromLine className="h-4 w-4 text-[var(--color-brand-ink)]" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--color-ink)]">
                    {KIND_COPY[e.kind] ?? 'Vault action'}
                    {e.label ? ` · ${e.label}` : ''}
                  </p>
                  <p className="text-xs text-[var(--color-ink-soft)]">{timeAgo(e.createdAt)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display font-semibold text-[var(--color-brand)]">
                  {fmtAmount(e.amount, 'XLM')}
                </p>
                <a
                  href={explorerTxUrl(e.txHash, NETWORK)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-brand)]"
                >
                  {truncateAddress(e.txHash, 4, 4)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// --- Modals ---------------------------------------------------------------

function AddPocketModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [weeklyAmount, setWeeklyAmount] = useState('5');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setLabel('');
    setAddress('');
    setWeeklyAmount('5');
    setErr(null);
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiPost('/api/recipients', {
        label,
        address: address.trim(),
        asset: 'XLM',
        weeklyAmount,
      });
      toast.success('Pocket added');
      reset();
      onClose();
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add pocket');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Add a pocket" subtitle="Who is this allowance for?" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Pocket name" hint="A friendly label only you see, e.g. “Maya's allowance”.">
          <input
            className={inputClass}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Maya's allowance"
            maxLength={40}
          />
        </Field>
        <Field
          label="Recipient Stellar address"
          hint="Starts with G. The recipient claims their allowance to this wallet."
        >
          <input
            className={`${inputClass} font-mono`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="GABC…"
          />
        </Field>
        <Field
          label="Suggested allowance (XLM)"
          hint="Pre-fills the amount when you set an allowance."
        >
          <input
            className={inputClass}
            value={weeklyAmount}
            onChange={(e) => setWeeklyAmount(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        {err && <p className="text-sm font-medium text-[var(--color-danger)]">{err}</p>}
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={submit} loading={busy} disabled={!label || !address}>
            Add pocket
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MoveModal({
  mode,
  vault,
  account,
  onClose,
  onDone,
}: {
  mode: null | 'deposit' | 'withdraw';
  vault: VaultState | null;
  account: ReturnType<typeof useFamilyData>['account'];
  onClose: () => void;
  onDone: () => void;
}) {
  const { signXdr } = useWallet();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<string | null>(null);

  const open = mode !== null;
  if (mode && mode !== lastMode) {
    setLastMode(mode);
    setAmount('');
    setErr(null);
    setDone(null);
  }
  if (!mode && lastMode) setLastMode(null);

  if (!open || !mode) return null;

  const isDeposit = mode === 'deposit';
  const max = isDeposit ? account?.xlmBalance : vault?.vault.unallocated;

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const hash = await runVaultAction(signXdr, isDeposit ? 'deposit' : 'withdraw', amount);
      setDone(hash);
      toast.success(`${isDeposit ? 'Deposited' : 'Withdrew'} ${fmtAmount(amount, 'XLM')}`);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Transaction failed');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setDone(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={done ? 'Done' : isDeposit ? 'Deposit XLM to vault' : 'Withdraw unallocated XLM'}
      subtitle={
        done
          ? undefined
          : isDeposit
            ? 'Locks XLM into the FamilyVault contract.'
            : 'Returns free (unallocated) XLM to your wallet.'
      }
      onClose={close}
    >
      {done ? (
        <ResultBody
          hash={done}
          amount={amount}
          verb={isDeposit ? 'deposited' : 'withdrawn'}
          onClose={close}
        />
      ) : (
        <div className="space-y-4">
          <Field
            label="Amount (XLM)"
            hint={max ? `Available: ${fmtAmount(max, 'XLM')}` : undefined}
          >
            <input
              className={`${inputClass} text-lg font-semibold`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              autoFocus
            />
          </Field>
          {err && <p className="text-sm font-medium text-[var(--color-danger)]">{err}</p>}
          <div className="flex gap-3 pt-1">
            <Button variant="ghost" className="flex-1" onClick={close}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={run} loading={busy} disabled={!amount}>
              {busy ? 'Signing…' : isDeposit ? 'Deposit' : 'Withdraw'}
            </Button>
          </div>
          <SignHint />
        </div>
      )}
    </Modal>
  );
}

function SetAllowanceModal({
  recipient,
  vault,
  currentAllowance,
  onClose,
  onDone,
}: {
  recipient: Recipient | null;
  vault: VaultState | null;
  currentAllowance: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { signXdr } = useWallet();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState('');

  const open = recipient !== null;
  if (recipient && recipient.id !== lastKey) {
    setLastKey(recipient.id);
    setAmount(currentAllowance !== '0' ? currentAllowance : recipient.weeklyAmount);
    setErr(null);
    setDone(null);
  }
  if (!recipient && lastKey) setLastKey('');

  if (!open || !recipient) return null;

  const free = vault?.vault.unallocated ?? '0';

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const hash = await runVaultAction(signXdr, 'allowance', amount, recipient.id);
      setDone(hash);
      toast.success(`Allowance for ${recipient.label} set to ${fmtAmount(amount, 'XLM')}`);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not set allowance');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setDone(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={done ? 'Allowance updated' : `Allowance for ${recipient.label}`}
      subtitle={done ? undefined : 'Sets the total this recipient can claim.'}
      onClose={close}
    >
      {done ? (
        <ResultBody hash={done} amount={amount} verb="allocated" onClose={close} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-[var(--color-bg-soft)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
            Current allowance: <strong>{fmtAmount(currentAllowance, 'XLM')}</strong> · Free to
            allocate: <strong>{fmtAmount(free, 'XLM')}</strong>
          </div>
          <Field
            label="New allowance (XLM)"
            hint="This is the absolute amount they can claim, not an increment."
          >
            <input
              className={`${inputClass} text-lg font-semibold`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              autoFocus
            />
          </Field>
          {err && <p className="text-sm font-medium text-[var(--color-danger)]">{err}</p>}
          <div className="flex gap-3 pt-1">
            <Button variant="ghost" className="flex-1" onClick={close}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={run} loading={busy} disabled={!amount}>
              {busy ? 'Signing…' : 'Set allowance'}
            </Button>
          </div>
          <SignHint />
        </div>
      )}
    </Modal>
  );
}

function ClaimModal({
  target,
  onClose,
  onDone,
}: {
  target: Claimable | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { signXdr } = useWallet();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState('');

  const open = target !== null;
  if (target && target.recipientId !== lastKey) {
    setLastKey(target.recipientId);
    setAmount(target.claimable);
    setErr(null);
    setDone(null);
  }
  if (!target && lastKey) setLastKey('');

  if (!open || !target) return null;

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const hash = await runVaultAction(signXdr, 'claim', amount, target.recipientId);
      setDone(hash);
      toast.success(`Claimed ${fmtAmount(amount, 'XLM')}`);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Claim failed');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setDone(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={done ? 'Claimed' : `Claim from ${target.label}`}
      subtitle={done ? undefined : `Up to ${fmtAmount(target.claimable, 'XLM')} available`}
      onClose={close}
    >
      {done ? (
        <ResultBody hash={done} amount={amount} verb="claimed" onClose={close} />
      ) : (
        <div className="space-y-4">
          <Field label="Amount to claim (XLM)">
            <input
              className={`${inputClass} text-lg font-semibold`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              autoFocus
            />
          </Field>
          {err && <p className="text-sm font-medium text-[var(--color-danger)]">{err}</p>}
          <div className="flex gap-3 pt-1">
            <Button variant="ghost" className="flex-1" onClick={close}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={run} loading={busy} disabled={!amount}>
              {busy ? 'Signing…' : 'Claim allowance'}
            </Button>
          </div>
          <SignHint />
        </div>
      )}
    </Modal>
  );
}

function ResultBody({
  hash,
  amount,
  verb,
  onClose,
}: {
  hash: string;
  amount: string;
  verb: string;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-soft)]">
        <ShieldCheck className="h-6 w-6 text-[var(--color-brand-ink)]" />
      </span>
      <p className="font-display text-2xl font-semibold text-[var(--color-brand)]">
        {fmtAmount(amount, 'XLM')}
      </p>
      <p className="text-sm text-[var(--color-ink-soft)]">
        {verb} on the FamilyVault contract. Verifiable on Stellar {NETWORK}.
      </p>
      <a
        href={explorerTxUrl(hash, NETWORK)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-bg-soft)] px-4 py-3 font-mono text-xs text-[var(--color-ink)] hover:text-[var(--color-brand)]"
      >
        {truncateAddress(hash, 10, 10)}
        <ExternalLink className="h-4 w-4" />
      </a>
      <Button className="w-full" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

function SignHint() {
  return (
    <p className="flex items-center justify-center gap-1.5 text-center text-xs text-[var(--color-ink-soft)]">
      <Spinner className="hidden" />
      Your wallet will ask you to approve a Soroban contract call.
    </p>
  );
}
