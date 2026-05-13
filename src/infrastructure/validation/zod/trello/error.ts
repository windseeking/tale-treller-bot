import { z } from 'zod'

import { ZodValidator } from '#validators/validator.js'

const errorSchema = z.object({
  message: z.string().optional(),
  error: z.string().optional()
})

export default new ZodValidator(errorSchema)
