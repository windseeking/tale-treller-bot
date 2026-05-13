import { z } from 'zod'

import { ZodValidator } from '#validators/validator.js'

export const listSchema = z.object({
  id: z.string(),
  name: z.string(),
  idBoard: z.string(),
  closed: z.boolean().default(false),
  pos: z.number()
})

export default new ZodValidator(listSchema)
