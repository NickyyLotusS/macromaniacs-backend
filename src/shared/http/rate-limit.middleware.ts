import type { NextFunction, Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

export type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  loginMaxRequests: number;
};

export function rateLimitMiddleware(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  return (request: Request, response: Response, next: NextFunction): void => {
    const now = Date.now();
    const login =
      request.method === 'POST' &&
      /^\/v\d+\/auth\/login(?:\?|$)/.test(request.originalUrl);
    const limit = login ? options.loginMaxRequests : options.maxRequests;
    const scope = login ? 'login' : 'api';
    const address = request.ip || request.socket.remoteAddress || 'unknown';
    const key = `${scope}:${address}`;
    const previous = buckets.get(key);
    const bucket =
      !previous || previous.resetAt <= now
        ? { count: 0, resetAt: now + options.windowMs }
        : previous;
    bucket.count += 1;
    buckets.set(key, bucket);
    response.setHeader('X-RateLimit-Limit', String(limit));
    response.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(0, limit - bucket.count)),
    );
    response.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil(bucket.resetAt / 1000)),
    );
    if (bucket.count > limit) {
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))),
      );
      response.status(429).json({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        timestamp: new Date().toISOString(),
        path: request.originalUrl,
        correlationId: (request as Request & { correlationId?: string })
          .correlationId,
      });
      return;
    }
    if (buckets.size > 10_000) {
      for (const [candidate, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(candidate);
      }
    }
    next();
  };
}

export function secureHeadersMiddleware(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  next();
}
