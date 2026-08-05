/**
 * XLM <-> stroop conversion. The native asset has 7 decimal places, so one XLM
 * is 10,000,000 stroops. The Soroban vault stores everything in stroops (i128);
 * the UI speaks decimal XLM. These helpers are the single source of truth for
 * that boundary so rounding can never drift between routes.
 */
export const STROOPS_PER_XLM = 10_000_000n;

/** "1.5" (XLM, max 7 dp) -> 15000000n (stroops). Throws on malformed input. */
export function toStroops(decimal: string): bigint {
  const trimmed = decimal.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) {
    throw new Error('Amount must be a positive number with up to 7 decimals');
  }
  const [whole, frac = ''] = trimmed.split('.');
  const fracPadded = (frac + '0000000').slice(0, 7);
  return BigInt(whole) * STROOPS_PER_XLM + BigInt(fracPadded);
}

/** 15000000n (stroops) -> "1.5" (XLM), trailing zeros trimmed. */
export function fromStroops(stroops: bigint | string | number): string {
  const v = typeof stroops === 'bigint' ? stroops : BigInt(stroops);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / STROOPS_PER_XLM;
  const frac = abs % STROOPS_PER_XLM;
  const fracStr = frac.toString().padStart(7, '0').replace(/0+$/, '');
  const out = fracStr ? `${whole}.${fracStr}` : `${whole}`;
  return neg ? `-${out}` : out;
}
