import type { ValidationIssue } from '../interfaces/validator.js'
import { AppError } from './app-error.js'

export class ValidationError extends AppError {
  public constructor(params: {
    message?: string;
    code?: string;
    details?: ValidationIssue[] | string[];
  }) {
    super({
      message: params.message ?? 'Provided data is invalid',
      code: params.code ?? 'VALIDATION_ERROR',
      statusCode: 422,
      details: params.details
    })

    this.name = 'ValidationError'
  }
}
