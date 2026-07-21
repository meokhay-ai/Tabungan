import { describe, expect, it } from 'vitest';
import { amountSchema, assetSchema, labelSchema } from '@/server/lib/validators';
import { fromStroops, isValidAddress, toStroops } from '@/server/stellar';
import { explorerTxUrl, fmtAmount, truncateAddress } from '@/ui/lib/format';

const REAL_ADDR = 'GBL5RJKF4QNJ4ZPLJZ7PS7K5A4J44VEZJRV2CRTFFDRVSY2N76AIIE47';

describe('validators', () => {
  it('accepts positive decimal amounts', () => {
    expect(amountSchema.safeParse('5').success).toBe(true);
    expect(amountSchema.safeParse('1.5').success).toBe(true);
    expect(amountSchema.safeParse('0.0000001').success).toBe(true);
  });

  it('rejects zero, negatives, and junk', () => {
    expect(amountSchema.safeParse('0').success).toBe(false);
    expect(amountSchema.safeParse('-3').success).toBe(false);
    expect(amountSchema.safeParse('abc').success).toBe(false);
    expect(amountSchema.safeParse('1.123456789').success).toBe(false);
  });

  it('validates labels and assets', () => {
    expect(labelSchema.safeParse('Weekend pocket').success).toBe(true);
    expect(labelSchema.safeParse('').success).toBe(false);
    expect(labelSchema.safeParse('x'.repeat(41)).success).toBe(false);
    expect(assetSchema.safeParse('XLM').success).toBe(true);
    expect(assetSchema.safeParse('BTC').success).toBe(false);
  });
});

describe('stellar address validation', () => {
  it('accepts a real ed25519 public key', () => {
    expect(isValidAddress(REAL_ADDR)).toBe(true);
  });
  it('rejects malformed keys', () => {
    expect(isValidAddress('not-a-key')).toBe(false);
    expect(isValidAddress('GABC')).toBe(false);
    expect(isValidAddress('')).toBe(false);
  });
});

describe('stroop conversion', () => {
  it('converts XLM decimals to stroops', () => {
    expect(toStroops('1')).toBe(10_000_000n);
    expect(toStroops('1.5')).toBe(15_000_000n);
    expect(toStroops('0.0000001')).toBe(1n);
  });
  it('round-trips back to decimal XLM', () => {
    expect(fromStroops(10_000_000n)).toBe('1');
    expect(fromStroops(15_000_000n)).toBe('1.5');
    expect(fromStroops(1n)).toBe('0.0000001');
    expect(fromStroops(toStroops('123.4567'))).toBe('123.4567');
  });
});

describe('formatting', () => {
  it('truncates addresses', () => {
    expect(truncateAddress(REAL_ADDR, 4, 4)).toBe('GBL5…IE47');
    expect(truncateAddress('short')).toBe('short');
  });
  it('formats amounts with asset code', () => {
    expect(fmtAmount('5', 'XLM')).toBe('5 XLM');
    expect(fmtAmount('1.25', 'USDC')).toBe('1.25 USDC');
  });
  it('builds explorer links per network', () => {
    expect(explorerTxUrl('deadbeef', 'testnet')).toContain('/testnet/tx/deadbeef');
    expect(explorerTxUrl('deadbeef', 'public')).toContain('/public/tx/deadbeef');
  });
});
