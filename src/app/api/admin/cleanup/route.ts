import type { NextRequest } from 'next/server';
import { fromError, ok } from '@/server/lib/http';
import { cleanupService } from '@/server/service/cleanup.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.ADMIN_API_TOKEN;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const result = await cleanupService.runFullCleanup();
    return ok(result);
  } catch (err) {
    return fromError(err);
  }
}
