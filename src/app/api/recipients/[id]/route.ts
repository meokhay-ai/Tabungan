import type { NextRequest } from 'next/server';
import { requireWallet } from '@/server/lib/auth-guard';
import { fromError, ok } from '@/server/lib/http';
import { recipientService } from '@/server/service/recipient.service';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const wallet = await requireWallet(req);
    const { id } = await ctx.params;
    await recipientService.archive(wallet, id);
    return ok({ ok: true });
  } catch (err) {
    return fromError(err);
  }
}
