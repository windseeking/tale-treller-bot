import {z} from 'zod'

import {ZodValidator} from '#validators/validator.js'

// todo: align with bot messages

const newCardSchema = z.object({
    telegramUserId: z.number().int('Telegram user id must be an integer'),
    text: z.string().min(15, 'Card text must be at least 15 characters long'),
    listId: z.string().nonempty('Selected list is required to create card'),
    boardId: z.string().nonempty('Selected board is required to create card'),
    currentDate: z.string().nonempty('Current date is required to create card'), // todo validate format
})

export default new ZodValidator(newCardSchema)
