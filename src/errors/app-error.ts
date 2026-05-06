export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly details?: unknown
  public readonly isOperational: boolean

  public constructor(params: {
    message: string;
    code: string;
    statusCode?: number;
    details?: unknown;
    isOperational?: boolean;
  }) {
    super(params.message)

    this.name = 'AppError'
    this.code = params.code
    this.statusCode = params.statusCode ?? 500
    this.details = params.details
    this.isOperational = params.isOperational ?? true
  }
}
