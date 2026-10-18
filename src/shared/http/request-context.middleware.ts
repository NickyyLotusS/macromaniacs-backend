import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type CorrelatedRequest = Request & { correlationId?: string };

const logger = new Logger('HTTP');
const correlationIdPattern = /^[A-Za-z0-9._-]{1,128}$/;

export function requestContextMiddleware(
  request: CorrelatedRequest,
  response: Response,
  next: NextFunction,
): void {
  const received = request.header('x-correlation-id');
  const correlationId =
    received && correlationIdPattern.test(received) ? received : randomUUID();
  const startedAt = process.hrtime.bigint();

  request.correlationId = correlationId;
  response.setHeader('x-correlation-id', correlationId);
  response.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.log(
      JSON.stringify({
        correlationId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      }),
    );
  });

  next();
}
