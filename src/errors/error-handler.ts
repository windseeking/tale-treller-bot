import { AppError } from './app-error.js'

export type ErrorContext = {
  scope: string;
  action?: string;
  metadata?: Record<string, unknown>;
};

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    return new AppError({
      message: error.message,
      code: 'UNEXPECTED_ERROR',
      details: { name: error.name, stack: error.stack },
      isOperational: false
    })
  }

  return new AppError({
    message: 'Unknown error',
    code: 'UNKNOWN_ERROR',
    details: { value: error },
    isOperational: false
  })
}

export function toLogPayload(error: AppError, context: ErrorContext): Record<string, unknown> {
  return {
    scope: context.scope,
    action: context.action,
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    details: error.details,
    metadata: context.metadata
  }
}
