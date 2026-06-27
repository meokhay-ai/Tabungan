export function truncateAddress(addr: string, pre = 4, suf = 4): string {
  if (!addr) return '';
  if (addr.length <= pre + suf + 1) return addr;
  return `${addr.slice(0, pre)}…${addr.slice(-suf)}`;
}

export function fmtAmount(value: string | number, asset: string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  const s = Number.isFinite(n)
    ? n.toLocaleString('en-US', { maximumFractionDigits: 7 })
    : String(value);
  return `${s} ${asset}`;
}

export function explorerTxUrl(hash: string, network: string): string {
  const net = network === 'public' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${net}/tx/${hash}`;
}

export function explorerAccountUrl(addr: string, network: string): string {
  const net = network === 'public' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${net}/account/${addr}`;
}

export function explorerContractUrl(contractId: string, network: string): string {
  const net = network === 'public' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${net}/contract/${contractId}`;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
