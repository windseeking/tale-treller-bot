import type { TaskContentGeneratorResolver } from '#interfaces/task/task-content-generator-resolver.js'
import type { TrelloAuthContext, TrelloAuthContextProvider } from '#interfaces/trello/auth/trello-auth-context.js'
import type { GeneratedTaskOutput, TaskGenerator } from '#interfaces/task/task-generator.js'
import type { TaskPayloadMapper } from '#interfaces/task/task-payload-mapper.js'
import type { TrelloCardInput, TrelloCard } from '#interfaces/trello/cards/trello-card.js'
import type { TrelloCardPayload } from '#interfaces/trello/cards/trello-card-payload.js'
import type { TrelloCardsGateway } from '#interfaces/trello/cards/trello-cards-gateway.js'
import type { UseCase } from '#interfaces/use-case.js'
import type { Validator } from '#interfaces/validator.js'
import { AppError } from '#errors/app-error.js'
import { ValidationError } from '#errors/validation-error.js'

export class CreateTrelloTask implements UseCase<TrelloCardInput, Promise<TrelloCard>> {
  public constructor(
    private readonly validator: Validator<TrelloCardInput>,
    private readonly authContextProvider: TrelloAuthContextProvider,
    private readonly generatorResolver: TaskContentGeneratorResolver,
    private readonly payloadMapper: TaskPayloadMapper<TrelloCardInput, GeneratedTaskOutput, TrelloAuthContext, TrelloCardPayload>,
    private readonly cardsGateway: TrelloCardsGateway
  ) {}

  public async call(input: TrelloCardInput): Promise<TrelloCard> {
    // 1. Validate input
    const { data, errors } = this.validator.validate(input)

    if (errors && errors.length > 0) {
      throw new ValidationError({
        message: 'Trello task input is invalid',
        code: 'TRELLO_TASK_INPUT_VALIDATION_ERROR',
        details: errors
      })
    }

    // 2. Get Trello auth context
    const auth: TrelloAuthContext | null = await this.authContextProvider.getActiveAuthContext(data.telegramUserId)
    if (!auth) {
      throw new AppError({
        message: 'Trello authorization is required',
        code: 'TRELLO_AUTH_REQUIRED',
        statusCode: 401
      })
    }

    // 3. Resolve task generator
    const generator: TaskGenerator = await this.generatorResolver.resolve({
      telegramUserId: data.telegramUserId,
      destinationId: 'trello'
    })

    // 4. Generate task card data
    const generated: GeneratedTaskOutput = await generator.generateTask({
      text: data.text,
      currentDate: data.currentDate
    })

    // 5. Prepare Trello API payload
    const payload: TrelloCardPayload = this.payloadMapper.map({ input: data, generated, context: auth })

    // 6. Create card
    return this.cardsGateway.createCard(payload, auth)
  }
}
