import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_CODES } from '@ai-mos/constants';

type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers['x-request-id'] as string) ?? 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ERROR_CODES.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const exObj = exceptionResponse as Record<string, unknown>;
        if (Array.isArray(exObj['message'])) {
          message = 'Validation failed';
          details = { errors: exObj['message'] };
        } else {
          message = (exObj['message'] as string) ?? exception.message;
        }
      } else {
        message = exceptionResponse as string;
      }

      code = this.mapStatusToCode(status);
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
    } else {
      this.logger.error('Unhandled non-Error exception', String(exception));
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private mapStatusToCode(status: number): ErrorCode {
    const map: Record<number, ErrorCode> = {
      400: ERROR_CODES.VALIDATION_ERROR,
      401: ERROR_CODES.UNAUTHORIZED,
      403: ERROR_CODES.FORBIDDEN,
      404: ERROR_CODES.NOT_FOUND,
      409: ERROR_CODES.CONFLICT,
      500: ERROR_CODES.INTERNAL_ERROR,
      503: ERROR_CODES.SERVICE_UNAVAILABLE,
    };
    return map[status] ?? ERROR_CODES.INTERNAL_ERROR;
  }
}
