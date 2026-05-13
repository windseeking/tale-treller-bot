import { z } from 'zod'
import normalizeDueDate from '../../../utils/normalizeDueDate.js'
import {ZodValidator} from '#validators/validator.js'

// todo: make urlSource .url() but check why validation fails

const llmOutputSchema = z.object({
    name: z.string().min(1),
    desc: z.string().min(1),
    due: z.preprocess(normalizeDueDate, z.iso.datetime({ offset: true })).optional(),
    urlSource: z.string().optional()
})

export default new ZodValidator(llmOutputSchema)
