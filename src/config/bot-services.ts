import type { TrelloAuthServices } from './trello-auth-services.js'
import { BotCallbackController } from '#controllers/bot/callback-controller.js'
import { BotStartController } from '#controllers/bot/start-controller.js'
import { BotTextController } from '#controllers/bot/text-controller.js'
import { TrelloDestinationHandler } from '#controllers/bot/destinations/trello-destination-handler.js'
import { InMemoryTaskDestinationRegistry } from '#controllers/bot/task-destination-registry.js'
import { ValidateDraft } from '#usecases/task/validate-draft.js'
import { CreateTrelloTask } from '#usecases/trello/create-trello-task.js'
import { ListBoardLists } from '#usecases/trello/list-board-lists.js'
import { ListTrelloBoards } from '#usecases/trello/list-trello-boards.js'
import { TelegramUsersRepository } from '../infrastructure/data-access/postgres/repositories/telegram-users-repository.js'
import { UserSettingsRepository } from '../infrastructure/data-access/postgres/repositories/user-settings-repository.js'
import { DefaultTaskContentGeneratorResolver } from '@llm/default-task-content-generator-resolver.js'
import { LlmClient } from '@llm/llm-card-generator.js'
import { SessionStore } from '@bot/session-store.js'
import { TrelloCardPayloadMapper } from '@trello/trello-card-payload-mapper.js'
import { TrelloClient } from '@trello/trello-client.js'
import { timeZoneProvider } from '../infrastructure/settings/time-zone.js'
import cardCreateValidator from '#validators/trello/cardCreate.js'

export type BotServices = {
  startController: BotStartController;
  textController: BotTextController;
  callbackController: BotCallbackController;
};

export function createBotServices(params: {
  telegramUsersRepository: TelegramUsersRepository;
  userSettingsRepository: UserSettingsRepository;
  trelloAuthServices: TrelloAuthServices;
}): BotServices {
  const sessions = new SessionStore()
  const trelloClient = new TrelloClient()
  const llmClient = new LlmClient()
  const generatorResolver = new DefaultTaskContentGeneratorResolver(llmClient)
  const createTrelloTask = new CreateTrelloTask(
    cardCreateValidator,
    params.trelloAuthServices.authContextProvider,
    generatorResolver,
    new TrelloCardPayloadMapper(),
    trelloClient
  )
  const trelloDestination = new TrelloDestinationHandler(
    sessions,
    params.trelloAuthServices.initConnection,
    params.trelloAuthServices.getStatus,
    params.trelloAuthServices.authContextProvider,
    params.trelloAuthServices.disconnectAccount,
    new ListTrelloBoards(trelloClient),
    new ListBoardLists(trelloClient),
    createTrelloTask,
    params.userSettingsRepository,
    timeZoneProvider
  )
  const destinations = new InMemoryTaskDestinationRegistry([trelloDestination], 'trello')

  return {
    startController: new BotStartController(
      sessions,
      params.telegramUsersRepository,
      destinations
    ),
    textController: new BotTextController(
      sessions,
      params.telegramUsersRepository,
      new ValidateDraft(),
      destinations
    ),
    callbackController: new BotCallbackController(
      sessions,
      params.telegramUsersRepository,
      destinations
    )
  }
}
