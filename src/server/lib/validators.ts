import { z } from 'zod';

export const amountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,7})?$/, 'Enter a valid amount (up to 7 decimals)')
  .refine((v) => Number(v) > 0, 'Amount must be greater than zero');

export const assetSchema = z.enum(['XLM', 'USDC']);

export const labelSchema = z
  .string()
  .trim()
  .min(1, 'Give this pocket a name')
  .max(40, 'Name is too long (max 40 chars)');

export async function parseJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return schema.parse(body);
}
