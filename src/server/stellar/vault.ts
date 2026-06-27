import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  type xdr,
} from '@stellar/stellar-sdk';
import { stellar } from '@/server/config/stellar';
import { AppError } from '@/server/lib/http';
import { isValidAddress } from './network';

/**
 * The Soroban side of Tabungan: building, submitting and reading the FamilyVault
 * contract. Writes (deposit / set_allowance / claim / withdraw) are built here
 * UNSIGNED, signed by the connected wallet in the browser, then submitted +
 * polled here via the Soroban RPC. Because the transaction source is always the
 * address whose `require_auth` the contract checks, a single envelope signature
 * authorizes the inner contract call — no separate auth-entry signing needed.
 */

function server(): rpc.Server {
  return new rpc.Server(stellar.sorobanRpcUrl, {
    allowHttp: stellar.sorobanRpcUrl.startsWith('http://'),
  });
}

function contract(): Contract {
  return new Contract(stellar.contractId);
}

function addr(a: string): xdr.ScVal {
  return new Address(a).toScVal();
}

function i128(stroops: bigint): xdr.ScVal {
  return nativeToScVal(stroops, { type: 'i128' });
}

export type VaultMethod = 'deposit' | 'set_allowance' | 'claim' | 'withdraw_unallocated';

/** Map a raw Soroban/host error string to a friendly, user-facing message. */
function mapContractError(raw: string): string {
  const m = raw.match(/Error\(Contract,\s*#(\d+)\)/);
  const code = m ? Number(m[1]) : undefined;
  switch (code) {
    case 1:
      return 'The vault is already initialized.';
    case 2:
      return 'The vault contract is not initialized yet.';
    case 3:
      return 'You are not authorized for this action.';
    case 4:
      return 'The vault is paused. Please try again later.';
    case 5:
      return 'Enter an amount greater than zero.';
    case 6:
      return 'Allowance cannot be negative.';
    case 7:
      return 'No vault yet — deposit XLM into your vault first.';
    case 8:
      return 'That allowance is more than your unallocated balance. Deposit more or lower it.';
    case 9:
      return 'You are trying to claim more than your current allowance.';
    case 10:
      return 'You are trying to withdraw more than your unallocated balance.';
    default:
      break;
  }
  if (/insufficient|underfunded|trustline|balance/i.test(raw)) {
    return 'Not enough XLM in the source account to cover this transaction and its fee.';
  }
  return 'The contract rejected this transaction. Please check the amount and try again.';
}

/**
 * Build an UNSIGNED, simulation-prepared invoke for a write entrypoint.
 * `source` is the wallet that will sign (and whose auth the contract requires).
 */
export async function buildVaultInvoke(
  source: string,
  method: VaultMethod,
  args: xdr.ScVal[],
): Promise<string> {
  if (!isValidAddress(source)) throw new AppError('INVALID_PUBLIC_KEY', 'Invalid wallet', 400);
  const srv = server();
  let account: Awaited<ReturnType<rpc.Server['getAccount']>>;
  try {
    account = await srv.getAccount(source);
  } catch {
    throw new AppError(
      'CHAIN_ERROR',
      'Your wallet is not funded on testnet yet. Fund it with friendbot first.',
      400,
    );
  }

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: stellar.passphrase,
  })
    .addOperation(contract().call(method, ...args))
    .setTimeout(180)
    .build();

  let prepared: Awaited<ReturnType<rpc.Server['prepareTransaction']>>;
  try {
    prepared = await srv.prepareTransaction(tx);
  } catch (err) {
    throw new AppError('CHAIN_ERROR', mapContractError(String(err)), 400);
  }
  return prepared.toXDR();
}

export type SubmitResult = { hash: string; returnValue: unknown };

/** Submit a wallet-signed Soroban XDR and poll the RPC until it settles. */
export async function submitVaultXdr(signedXdr: string): Promise<SubmitResult> {
  const srv = server();
  let tx: ReturnType<typeof TransactionBuilder.fromXDR>;
  try {
    tx = TransactionBuilder.fromXDR(signedXdr, stellar.passphrase);
  } catch {
    throw new AppError('INVALID_INPUT', 'Malformed signed transaction', 400);
  }

  // The RPC occasionally answers TRY_AGAIN_LATER for a moment after a previous
  // tx from the same source; a couple of quick retries smooth that over.
  let sent: Awaited<ReturnType<rpc.Server['sendTransaction']>>;
  for (let attempt = 0; ; attempt++) {
    try {
      sent = await srv.sendTransaction(tx);
    } catch (err) {
      throw new AppError('CHAIN_ERROR', mapContractError(String(err)), 400);
    }
    if (sent.status !== 'TRY_AGAIN_LATER' || attempt >= 3) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (sent.status === 'ERROR') {
    throw new AppError(
      'CHAIN_ERROR',
      mapContractError(JSON.stringify(sent.errorResult ?? '')),
      400,
    );
  }

  // Poll until SUCCESS / FAILED, bounded well under the 60s route budget.
  const deadline = Date.now() + 54_000;
  let got = await srv.getTransaction(sent.hash);
  while (got.status === rpc.Api.GetTransactionStatus.NOT_FOUND && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    got = await srv.getTransaction(sent.hash);
  }

  if (got.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    const detail =
      got.status === rpc.Api.GetTransactionStatus.FAILED
        ? mapContractError(JSON.stringify(got.resultXdr ?? got))
        : 'The transaction did not confirm in time. Check the explorer and retry.';
    throw new AppError('CHAIN_ERROR', detail, 400);
  }

  let returnValue: unknown = null;
  try {
    if (got.returnValue) returnValue = scValToNative(got.returnValue);
  } catch {
    /* ignore decode issues — the tx still succeeded */
  }
  return { hash: sent.hash, returnValue };
}

/** Read-only contract view via simulation. `source` only needs to exist on-chain. */
async function readView(source: string, method: string, args: xdr.ScVal[]): Promise<unknown> {
  const srv = server();
  const account = await srv.getAccount(source);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: stellar.passphrase,
  })
    .addOperation(contract().call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await srv.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new AppError('CHAIN_ERROR', mapContractError(sim.error), 400);
  }
  const retval = sim.result?.retval;
  return retval ? scValToNative(retval) : null;
}

// --- Typed builders for each entrypoint -----------------------------------

export function buildDeposit(parent: string, amount: bigint) {
  return buildVaultInvoke(parent, 'deposit', [addr(parent), i128(amount)]);
}

export function buildSetAllowance(parent: string, recipient: string, amount: bigint) {
  return buildVaultInvoke(parent, 'set_allowance', [addr(parent), addr(recipient), i128(amount)]);
}

export function buildWithdraw(parent: string, amount: bigint) {
  return buildVaultInvoke(parent, 'withdraw_unallocated', [addr(parent), i128(amount)]);
}

export function buildClaim(parent: string, recipient: string, amount: bigint) {
  // `recipient` is the signer/source — the contract requires the recipient's auth.
  return buildVaultInvoke(recipient, 'claim', [addr(parent), addr(recipient), i128(amount)]);
}

// --- Typed reads -----------------------------------------------------------

export type VaultState = { balance: bigint; allocated: bigint };

export async function readVault(parent: string): Promise<VaultState> {
  const v = (await readView(parent, 'get_vault', [addr(parent)])) as {
    balance: bigint;
    allocated: bigint;
  } | null;
  return { balance: BigInt(v?.balance ?? 0n), allocated: BigInt(v?.allocated ?? 0n) };
}

export async function readAllowance(
  source: string,
  parent: string,
  recipient: string,
): Promise<bigint> {
  const v = (await readView(source, 'get_allowance', [addr(parent), addr(recipient)])) as
    | bigint
    | number
    | null;
  return BigInt(v ?? 0n);
}
