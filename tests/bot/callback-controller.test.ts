import assert from 'node:assert/strict'
import test from 'node:test'

import type { BotMessageOptions, BotMessenger, BotSentMessage } from '../../src/interfaces/bot.ts'
import type { TrelloAuthContext } from '../../src/interfaces/trello/auth/trello-auth-context.ts'

setupEnv()

class FakeMessenger implements BotMessenger {
  public readonly replies: Array<{ text: string; options?: BotMessageOptions }> = []
  public readonly callbackEdits: string[] = []
  public readonly botEdits: string[] = []
  public readonly botEditOptions: Array<BotMessageOptions | undefined> = []
  public answerCount = 0

  public async replyMarkdown(text: string, options?: BotMessageOptions): Promise<BotSentMessage> {
    this.replies.push({ text, options })
    return { messageId: this.replies.length }
  }

  public async answerCallbackQuery(): Promise<void> {
    this.answerCount += 1
  }

  public async replaceCallbackMessageText(text: string): Promise<void> {
    this.callbackEdits.push(text)
  }

  public async replaceBotMessageText(_messageId: number, text: string, options?: BotMessageOptions): Promise<void> {
    this.botEdits.push(text)
    this.botEditOptions.push(options)
  }

  public async tryDeleteIncomingMessage(): Promise<void> {}
  public async hideMainReplyKeyboard(): Promise<void> {}
}

test('BotCallbackController routes trello callbacks through TrelloDestinationHandler', async () => {
  const {
    BotCallbackController,
    InMemoryTaskDestinationRegistry,
    SessionStore,
    TrelloDestinationHandler,
    BOT_MESSAGES
  } = await loadCallbackModules()

  const auth: TrelloAuthContext = {
    apiKey: 'key',
    token: 'token',
    memberId: 'member-1'
  }
  const sessions = new SessionStore()
  const session = sessions.get(100)
  session.messages = ['This is the draft text']
  session.draftText = 'This is the draft text'
  sessions.startDestinationFlow(session, {
    destinationId: 'trello',
    selectionStep: 'trello:board',
    state: {
      boards: [{ id: 'board-1', name: 'Roadmap', url: 'https://trello/board', closed: false }]
    }
  })

  const createdInputs: unknown[] = []
  const trelloDestination = new TrelloDestinationHandler(
    sessions,
    {
      async createAuthorizationLink() {
        return { url: 'https://auth.example', expiresAt: new Date() }
      },
      async getConnectionStatus() {
        return { connected: true }
      },
      async getActiveAuthContext() {
        return auth
      },
      async revokeConnection() {}
    },
    { async call() { return [{ id: 'board-1', name: 'Roadmap', url: 'https://trello/board', closed: false }] } } as never,
    { async call() { return [{ id: 'list-1', name: 'Doing', idBoard: 'board-1', closed: false, pos: 1 }] } } as never,
    {
      async call(input: unknown) {
        createdInputs.push(input)
        return {
          id: 'card-1',
          name: 'Created card',
          desc: 'desc',
          url: 'https://trello/card',
          shortUrl: 'https://trello/c/1',
          idList: 'list-1',
          idBoard: 'board-1'
        }
      }
    } as never,
    { async findTimeZone() { return null }, async upsertTimeZone() {} }
  )
  const registry = new InMemoryTaskDestinationRegistry([trelloDestination], 'trello')
  const controller = new BotCallbackController(
    sessions,
    { async upsert() {}, async findByTelegramUserId() { return null } },
    registry
  )
  const messenger = new FakeMessenger()
  const identity = { chatId: 100, telegramUserId: 200 }

  await controller.handle({ identity, callbackData: 'trello:board:board-1', messenger })

  assert.equal(messenger.answerCount, 1)
  assert.match(messenger.callbackEdits[0] ?? '', /Доска: \*Roadmap\*/)
  assert.equal(session.stage, 'destination_flow')
  assert.equal(session.selectionStep, 'trello:list')
  assert.equal(messenger.replies.at(-1)?.text, BOT_MESSAGES.pickList)

  await controller.handle({ identity, callbackData: 'trello:list:list-1', messenger })

  assert.match(messenger.callbackEdits[1] ?? '', /Колонка: \*Doing\*/)
  assert.equal(createdInputs.length, 1)
  assert.match(messenger.botEdits[0] ?? '', /Готово!/)
  assert.equal(session.stage, 'collecting')
  assert.equal(session.lastTarget?.id, 'list-1')
})

test('TrelloDestinationHandler omits card inline keyboard when created card URL is invalid', async () => {
  const {
    BotCallbackController,
    InMemoryTaskDestinationRegistry,
    SessionStore,
    TrelloDestinationHandler
  } = await loadCallbackModules()

  const sessions = new SessionStore()
  const session = sessions.get(100)
  session.messages = ['This is the draft text']
  session.draftText = 'This is the draft text'
  sessions.startDestinationFlow(session, {
    destinationId: 'trello',
    selectionStep: 'trello:list',
    state: {
      selectedBoardId: 'board-1',
      selectedBoardName: 'Roadmap',
      lists: [{ id: 'list-1', name: 'Doing', idBoard: 'board-1', closed: false, pos: 1 }]
    }
  })

  const trelloDestination = new TrelloDestinationHandler(
    sessions,
    {
      async createAuthorizationLink() {
        return { url: 'https://auth.example', expiresAt: new Date() }
      },
      async getConnectionStatus() {
        return { connected: true }
      },
      async getActiveAuthContext() {
        return { apiKey: 'key', token: 'token', memberId: 'member-1' }
      },
      async revokeConnection() {}
    },
    { async call() { return [] } } as never,
    { async call() { return [] } } as never,
    {
      async call() {
        return {
          id: 'card-1',
          name: 'Created card',
          desc: 'desc',
          url: 'not-a-url',
          shortUrl: 'not-a-url',
          idList: 'list-1',
          idBoard: 'board-1'
        }
      }
    } as never,
    { async findTimeZone() { return null }, async upsertTimeZone() {} }
  )
  const registry = new InMemoryTaskDestinationRegistry([trelloDestination], 'trello')
  const controller = new BotCallbackController(
    sessions,
    { async upsert() {}, async findByTelegramUserId() { return null } },
    registry
  )
  const messenger = new FakeMessenger()

  await controller.handle({
    identity: { chatId: 100, telegramUserId: 200 },
    callbackData: 'trello:list:list-1',
    messenger
  })

  assert.match(messenger.botEdits[0] ?? '', /Готово!/)
  assert.equal(messenger.botEditOptions[0], undefined)
})

test('BotCallbackController handles unknown namespaced callback safely', async () => {
  const { BotCallbackController, InMemoryTaskDestinationRegistry, SessionStore, BOT_MESSAGES } = await loadCallbackModules()
  const sessions = new SessionStore()
  const registry = new InMemoryTaskDestinationRegistry([fakeDestination()], 'trello')
  const messenger = new FakeMessenger()
  const controller = new BotCallbackController(
    sessions,
    { async upsert() {}, async findByTelegramUserId() { return null } },
    registry
  )

  await controller.handle({
    identity: { chatId: 100, telegramUserId: 200 },
    callbackData: 'linear:unknown',
    messenger
  })

  assert.equal(messenger.replies[0]?.text, BOT_MESSAGES.unsupportedMessage)
})

test('TelegrafBotMessenger ignores expired callback query errors', async () => {
  const { TelegrafBotMessenger } = await import('../../src/infrastructure/bot/telegram-messenger.ts')
  const messenger = new TelegrafBotMessenger({
    async answerCbQuery() {
      throw new Error('Bad Request: query is too old and response timeout expired or query id is invalid')
    }
  } as never)

  await assert.doesNotReject(() => messenger.answerCallbackQuery())
})

async function loadCallbackModules() {
  const [
    { BotCallbackController },
    { InMemoryTaskDestinationRegistry },
    { SessionStore },
    { TrelloDestinationHandler },
    { BOT_MESSAGES }
  ] = await Promise.all([
    import('../../src/controllers/bot/callback-controller.ts'),
    import('../../src/controllers/bot/task-destination-registry.ts'),
    import('../../src/infrastructure/bot/session-store.ts'),
    import('../../src/controllers/bot/destinations/trello-destination-handler.ts'),
    import('../../src/infrastructure/bot/messages.ts')
  ])

  return { BotCallbackController, InMemoryTaskDestinationRegistry, SessionStore, TrelloDestinationHandler, BOT_MESSAGES }
}

function fakeDestination() {
  return {
    id: 'trello',
    ownsAction(action: string) {
      return action.startsWith('trello:')
    },
    ownsCallbackData(data: string) {
      return data.startsWith('trello:')
    },
    async getWelcomeResponse() {
      return { text: 'welcome', replyMarkup: {} }
    },
    async getMainReplyKeyboard() {
      return {}
    },
    async handleAction() {},
    async handleCallback() {},
    async handleTextDuringFlow() {},
    async beginTaskCreation() {}
  }
}

function setupEnv(): void {
  process.env.NODE_ENV = 'test'
  process.env.LOG_LEVEL = 'silent'
  process.env.APP_TIMEZONE = 'Europe/Lisbon'
  process.env.APP_BASE_URL = 'https://bot.example'
  process.env.APP_PORT = '3000'
  process.env.TELEGRAM_BOT_TOKEN = '123456:test-token'
  process.env.TRELLO_API_KEY = 'trello-key'
  process.env.TRELLO_API_SECRET = 'trello-secret'
  process.env.AUTH_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')
  process.env.AUTH_SESSION_TTL_MINUTES = '15'
  process.env.TRELLO_AUTH_TTL_DAYS = '30'
  process.env.DATABASE_URL = 'postgresql://example'
  process.env.LLM_API_KEY = 'llm-key'
  process.env.LLM_MODEL = 'test-model'
}
