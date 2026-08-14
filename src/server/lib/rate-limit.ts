import type { NextRequest, NextResponse } from 'next/server';

type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

type RequestRecord = {
  count: number;
  resetAt: number;
};

const requestCounts = new Map<string, RequestRecord>();

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (record.resetAt < now) {
      requestCounts.delete(key);
    }
  }
}, 60000);

process.on('exit', () => clearInterval(cleanupInterval));

export function getRateLimitKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown';
  return ip;
}

export function createRateLimiter(config: RateLimitConfig) {
  return (key: string): boolean => {
    const now = Date.now();
    const record = requestCounts.get(key);

    if (!record || record.resetAt < now) {
      requestCounts.set(key, { count: 1, resetAt: now + config.windowMs });
      return true;
    }

    if (record.count < config.maxRequests) {
      record.count++;
      return true;
    }

    return false;
  };
}

export function withRateLimit(config: RateLimitConfig) {
  const isAllowed = createRateLimiter(config);

  return (handler: (req: NextRequest, ctx?: any) => Promise<NextResponse>) => {
    return async (req: NextRequest, ctx?: any): Promise<NextResponse> => {
      const key = getRateLimitKey(req);
      if (!isAllowed(key)) {
        return new NextResponse('Too many requests', { status: 429 });
      }
      return handler(req, ctx);
    };
  };
}
