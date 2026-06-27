import { fromError, ok } from '@/server/lib/http';
import { statsService } from '@/server/service/stats.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return ok(await statsService.getPublic());
  } catch (err) {
    return fromError(err);
  }
}
