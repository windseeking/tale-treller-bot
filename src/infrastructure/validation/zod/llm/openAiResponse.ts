import { z } from 'zod'
import {ZodValidator} from '#validators/validator.js'

const openAiResponseSchema = z.object({
    choices: z
        .array(
            z.object({
                message: z.object({
                    content: z.string().nullable()
                })
            })
        )
        .min(1)
})

export default new ZodValidator(openAiResponseSchema)
