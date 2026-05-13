import type { z } from 'zod'

import type { ValidationResult, Validator } from '#interfaces/index.js'

export class ZodValidator<T> implements Validator<T> {
  public constructor(private readonly schema: z.ZodType<T>) {}

  public validate(data: unknown): ValidationResult<T> {
    const result = this.schema.safeParse(data)

    if (result.success) {
      return { data: result.data, errors: [] }
    }

    return {
      data: data as T,
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }))
    }
  }
}
