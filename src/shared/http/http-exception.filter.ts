import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ExceptionBody = {
  error?: string;
  message?: string | string[];
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionBody = this.getExceptionBody(exception);

    response.status(status).json({
      statusCode: status,
      error: exceptionBody.error ?? this.statusLabel(status),
      message:
        exceptionBody.message ??
        (status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error'
          : 'Request failed'),
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }

  private getExceptionBody(exception: unknown): ExceptionBody {
    if (!(exception instanceof HttpException)) {
      return {};
    }

    const body = exception.getResponse();

    if (typeof body === 'string') {
      return { message: body };
    }

    if (typeof body !== 'object' || body === null) {
      return {};
    }

    const record = body as Record<string, unknown>;

    return {
      error: typeof record.error === 'string' ? record.error : undefined,
      message:
        typeof record.message === 'string' || Array.isArray(record.message)
          ? (record.message as string | string[])
          : undefined,
    };
  }

  private statusLabel(status: number): string {
    return HttpStatus[status] ?? 'Error';
  }
}
