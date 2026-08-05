import { BASE_FEE, Operation, StrKey, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';
import { stellar, usdcAsset } from '@/server/config/stellar';
import { AppError } from '@/server/lib/http';

/**
 * Classic (Horizon) Stellar helpers, factored out of the old `lib/stellar-tx`.
 * These cover account reads, the USDC trustline opt-in, and classic submit —
 * everything that is NOT a Soroban contract call. The vault invoke flow lives
 * in `./vault`.
 */

export type AccountInfo = {
  exists: boolean;
  xlmBalance: string;
  usdcBalance: string;
  usdcTrustline: boolean;
};

export function isValidAddress(addr: string): boolean {
  return StrKey.isValidEd25519PublicKey(addr);
}

/** Read an account's balances + USDC trustline state from Horizon (best-effort). */
export async function getAccountInfo(publicKey: string): Promise<AccountInfo> {
  try {
    const acct = await stellar.server.loadAccount(publicKey);
    let xlm = '0';
    let usdc = '0';
    let usdcTrust = false;
    for (const b of acct.balances) {
      if (b.asset_type === 'native') {
        xlm = b.balance;
      } else if (
        (b.asset_type === 'credit_alphanum4' || b.asset_type === 'credit_alphanum12') &&
        b.asset_code === stellar.usdcCode &&
        b.asset_issuer === stellar.usdcIssuer
      ) {
        usdc = b.balance;
        usdcTrust = true;
      }
    }
    return { exists: true, xlmBalance: xlm, usdcBalance: usdc, usdcTrustline: usdcTrust };
  } catch {
    return { exists: false, xlmBalance: '0', usdcBalance: '0', usdcTrustline: false };
  }
}

/** Build the UNSIGNED changeTrust tx that opts a wallet into holding USDC. */
export async function buildUsdcTrustlineXdr(source: string): Promise<string> {
  if (!isValidAddress(source)) throw new AppError('INVALID_PUBLIC_KEY', 'Invalid wallet', 400);
  const sourceAccount = await stellar.server.loadAccount(source).catch(() => {
    throw new AppError(
      'CHAIN_ERROR',
      'Your wallet is not funded on testnet yet. Fund it with friendbot first.',
      400,
    );
  });
  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: stellar.passphrase,
  })
    .addOperation(Operation.changeTrust({ asset: usdcAsset }))
    .setTimeout(180)
    .build();
  return tx.toXDR();
}

/** Submit a wallet-signed CLASSIC XDR to Horizon and return the confirmed hash. */
export async function submitSignedXdr(signedXdr: string): Promise<string> {
  let tx: Transaction;
  try {
    tx = new Transaction(signedXdr, stellar.passphrase);
  } catch {
    throw new AppError('INVALID_INPUT', 'Malformed signed transaction', 400);
  }
  try {
    const res = await stellar.server.submitTransaction(tx);
    return res.hash;
  } catch (err: unknown) {
    throw new AppError('CHAIN_ERROR', describeHorizonError(err), 400);
  }
}

function describeHorizonError(err: unknown): string {
  const e = err as {
    response?: {
      data?: { extras?: { result_codes?: { operations?: string[]; transaction?: string } } };
    };
  };
  const codes = e?.response?.data?.extras?.result_codes;
  const opCode = codes?.operations?.find((c) => c && c !== 'op_success');
  if (opCode === 'op_no_trust') return 'Recipient has no trustline for this asset.';
  if (opCode === 'op_underfunded') return 'Insufficient balance for this transaction.';
  if (opCode === 'op_no_destination') return 'Destination account does not exist.';
  if (codes?.transaction === 'tx_bad_seq') return 'Wallet sequence out of sync — please retry.';
  if (opCode) return `On-chain rejection: ${opCode}`;
  return 'The Stellar network rejected the transaction. Please try again.';
}
