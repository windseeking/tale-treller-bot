import { z } from 'zod'

import { ZodValidator } from '#validators/validator.js'
import { listSchema } from '#validators/trello/list.js'

export default new ZodValidator(z.array(listSchema))
