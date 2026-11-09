import { jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { rateLimitMiddleware } from '../../src/shared/http/rate-limit.middleware';

describe('rateLimitMiddleware', () => {
  it('applies the stricter login budget and emits retry metadata', () => {
    const middleware = rateLimitMiddleware({
      windowMs: 60_000,
      maxRequests: 10,
      loginMaxRequests: 2,
    });
    const request = {
      method: 'POST',
      originalUrl: '/v1/auth/login',
      ip: '127.0.0.1',
      socket: {},
    } as Request;
    const json = jest.fn();
    const status = jest.fn(() => ({ json })) as unknown as Response['status'];
    const setHeader = jest.fn();
    const response = { status, setHeader } as unknown as Response;
    const next = jest.fn() as NextFunction;

    middleware(request, response, next);
    middleware(request, response, next);
    middleware(request, response, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 429,
        message: 'Rate limit exceeded',
      }),
    );
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });
});
