import { ok } from '@/server/lib/http';

export const dynamic = 'force-dynamic';

export function GET() {
  return ok({ status: 'healthy', service: 'tabungan' });
}
