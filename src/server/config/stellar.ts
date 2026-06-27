import { Asset, Horizon, Networks } from '@stellar/stellar-sdk';
import { env } from './env';

const networkMap = {
  testnet: {
    passphrase: Networks.TESTNET,
    horizonUrl: 'https://horizon-testnet.stellar.org',
  },
  public: {
    passphrase: Networks.PUBLIC,
    horizonUrl: 'https://horizon.stellar.org',
  },
  futurenet: {
    passphrase: Networks.FUTURENET,
    horizonUrl: 'https://horizon-futurenet.stellar.org',
  },
} as const;

const cfg = networkMap[env.STELLAR_NETWORK];

export const stellar = {
  passphrase: env.STELLAR_NETWORK_PASSPHRASE || cfg.passphrase,
  horizonUrl: env.STELLAR_HORIZON_URL || cfg.horizonUrl,
  network: env.STELLAR_NETWORK,
  server: new Horizon.Server(env.STELLAR_HORIZON_URL || cfg.horizonUrl),
  usdcCode: env.USDC_ASSET_CODE,
  usdcIssuer: env.USDC_ASSET_ISSUER_TESTNET,
  sorobanRpcUrl: env.SOROBAN_RPC_URL,
  contractId: env.SOROBAN_CONTRACT_ID,
  vaultToken: env.VAULT_TOKEN_SAC,
} as const;

/** stellar.expert explorer URL for the FamilyVault contract on the active network. */
export function explorerContractUrl(contractId: string): string {
  const net = stellar.network === 'public' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${net}/contract/${contractId}`;
}

/** The USDC asset object for the configured testnet issuer. */
export const usdcAsset = new Asset(stellar.usdcCode, stellar.usdcIssuer);

/** stellar.expert explorer URL for a tx hash on the active network. */
export function explorerTxUrl(hash: string): string {
  const net = stellar.network === 'public' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${net}/tx/${hash}`;
}
