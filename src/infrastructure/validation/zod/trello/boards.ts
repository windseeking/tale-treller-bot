import { z } from 'zod'

import { ZodValidator } from '#validators/validator.js'
import { boardSchema } from '#validators/trello/board.js'

export default new ZodValidator(z.array(boardSchema))
