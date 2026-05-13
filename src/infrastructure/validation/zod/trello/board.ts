import { z } from 'zod'

import { ZodValidator } from '#validators/validator.js'

export const boardSchema = z.object({
    id: z.string(),
    name: z.string(),
    url: z.url(),
    closed: z.boolean().default(false)
})

export default new ZodValidator(boardSchema)
