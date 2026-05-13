import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  BotAction,
  BotMessageOptions,
  BotMessenger,
  BotRequest,
  BotSentMessage,
  TaskDestinationHandler,
  TaskDestinationRegistry
} from '../../src/interfaces/bot.ts'
import type { TelegramUsersRepositoryPort } from '../../src/interfaces/telegram-user/telegram-users-repository.ts'

setupEnv()

class FakeMessenger implements BotMessenger {
  public readonly replies: Array<{ text: string; options?: BotMessageOptions }> = []
  public deleteCount = 0
  public hideKeyboardCount = 0

  public async replyMarkdown(text: string, options?: BotMessageOptions): Promise<BotSentMessage> {
    this.replies.push({ text, options })
    return { messageId: this.replies.length }
  }

  public async answerCallbackQuery(): Promise<void> {}
  public async replaceCallbackMessageText(): Promise<void> {}
  public async replaceBotMessageText(): Promise<void> {}

  public async tryDeleteIncomingMessage(): Promise<void> {
    this.deleteCount += 1
  }

  public async hideMainReplyKeyboard(): Promise<void> {
    this.hideKeyboardCount += 1
  }
}

test('BotTextController silently appends ordinary text to the draft', async () => {
  const { BotTextController, SessionStore, ValidateDraft } = await loadTextControllerModules()
  const sessions = new SessionStore()
  const controller = new BotTextController(
    sessions,
    fakeTelegramUsersRepository(),
    new ValidateDraft(),
    fakeRegistry(fakeDestination())
  )
  const messenger = new FakeMessenger()

  await controller.handle({
    identity: identity(),
    body: { text: 'Please remember this task detail' },
    messenger
  })

  assert.deepEqual(sessions.get(100).messages, ['Please remember this task detail'])
  assert.deepEqual(messenger.replies, [])
})

test('BotTextController returns validation messages for empty and short drafts', async () => {
  const { BotTextController, SessionStore, ValidateDraft, BOT_MESSAGES } = await loadTextControllerModules()
  const emptySessions = new SessionStore()
  const emptyMessenger = new FakeMessenger()
  const emptyController = new BotTextController(
    emptySessions,
    fakeTelegramUsersRepository(),
    new ValidateDraft(),
    fakeRegistry(fakeDestination())
  )

  await emptyController.handle({
    identity: identity(),
    body: { text: 'Создать задачу' },
    messenger: emptyMessenger
  })

  assert.equal(emptyMessenger.deleteCount, 1)
  assert.equal(emptyMessenger.hideKeyboardCount, 1)
  assert.equal(emptyMessenger.replies[0]?.text, BOT_MESSAGES.draftEmpty)

  const shortSessions = new SessionStore()
  shortSessions.get(100).messages.push('too short')
  const shortMessenger = new FakeMessenger()
  const shortController = new BotTextController(
    shortSessions,
    fakeTelegramUsersRepository(),
    new ValidateDraft(),
    fakeRegistry(fakeDestination())
  )

  await shortController.handle({
    identity: identity(),
    body: { text: 'Создать задачу' },
    messenger: shortMessenger
  })

  assert.equal(shortMessenger.replies[0]?.text, BOT_MESSAGES.tooShort('too short'.length))
})

test('BotTextController preserves draft when destination reports auth-required interruption', async () => {
  const { BotTextController, SessionStore, ValidateDraft } = await loadTextControllerModules()
  const sessions = new SessionStore()
  sessions.get(100).messages.push('This is a long enough task draft')
  let beginCalled = false
  const destination = fakeDestination({
    async beginTaskCreation() {
      beginCalled = true
    }
  })
  const controller = new BotTextController(
    sessions,
    fakeTelegramUsersRepository(),
    new ValidateDraft(),
    fakeRegistry(destination)
  )

  await controller.handle({
    identity: identity(),
    body: { text: 'Создать задачу' },
    messenger: new FakeMessenger()
  })

  const session = sessions.get(100)
  assert.equal(beginCalled, true)
  assert.deepEqual(session.messages, ['This is a long enough task draft'])
  assert.equal(session.draftText, 'This is a long enough task draft')
})

test('BotTextController delegates Trello namespaced actions to destination handler', async () => {
  const { BotTextController, SessionStore, ValidateDraft } = await loadTextControllerModules()
  const sessions = new SessionStore()
  let handledAction: BotAction | null | undefined
  const destination = fakeDestination({
    async handleAction(request) {
      handledAction = request.action
    }
  })
  const controller = new BotTextController(
    sessions,
    fakeTelegramUsersRepository(),
    new ValidateDraft(),
    fakeRegistry(destination)
  )

  await controller.handle({
    identity: identity(),
    body: { text: '/trello_status' },
    messenger: new FakeMessenger()
  })

  assert.equal(handledAction, 'trello:status')
})

async function loadTextControllerModules() {
  const [
    { BotTextController },
    { SessionStore },
    { ValidateDraft },
    { BOT_MESSAGES }
  ] = await Promise.all([
    import('../../src/controllers/bot/text-controller.ts'),
    import('../../src/infrastructure/bot/session-store.ts'),
    import('../../src/use-cases/task/validate-draft.ts'),
    import('../../src/infrastructure/bot/messages.ts')
  ])

  return { BotTextController, SessionStore, ValidateDraft, BOT_MESSAGES }
}

function fakeDestination(overrides: Partial<TaskDestinationHandler> = {}): TaskDestinationHandler {
  return {
    id: 'trello',
    ownsAction(action) {
      return action.startsWith('trello:')
    },
    ownsCallbackData(data) {
      return data.startsWith('trello:')
    },
    async getWelcomeResponse() {
      return { text: 'welcome', replyMarkup: { keyboard: [] } }
    },
    async getMainReplyKeyboard() {
      return { keyboard: [] }
    },
    async handleAction() {},
    async handleCallback() {},
    async handleTextDuringFlow() {},
    async beginTaskCreation() {},
    ...overrides
  }
}

function fakeRegistry(destination: TaskDestinationHandler): TaskDestinationRegistry {
  return {
    getDefault() {
      return destination
    },
    findById(destinationId) {
      return destinationId === destination.id ? destination : null
    },
    findByAction(action) {
      return destination.ownsAction(action) ? destination : null
    },
    findByCallbackData(data) {
      return destination.ownsCallbackData(data) ? destination : null
    }
  }
}

function fakeTelegramUsersRepository(): TelegramUsersRepositoryPort {
  return {
    async upsert() {},
    async findByTelegramUserId() {
      return null
    }
  }
}

function identity(): BotRequest['identity'] {
  return { chatId: 100, telegramUserId: 200 }
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
