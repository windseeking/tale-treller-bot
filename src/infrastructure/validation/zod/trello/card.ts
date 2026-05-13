import { z } from 'zod'
import { ZodValidator } from '#validators/validator.js'

const trelloCardSchema = z.object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    desc: z.string().nonempty(),
    url: z.string().nonempty(),
    shortUrl: z.string().nonempty(),
    idList: z.string().nonempty(),
    idBoard: z.string().nonempty()
})

export default new ZodValidator(trelloCardSchema)
