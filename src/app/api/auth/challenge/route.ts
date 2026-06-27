import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { fromError, ok } from '@/server/lib/http';
import { parseJson } from '@/server/lib/validators';
import { authService } from '@/server/service/auth.service';

export const dynamic = 'force-dynamic';

const schema = z.object({ publicKey: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { publicKey } = await parseJson(req, schema);
    const data = await authService.createChallenge(publicKey);
    return ok(data);
  } catch (err) {
    return fromError(err);
  }
}
