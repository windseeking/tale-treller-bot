import assert from 'node:assert/strict'
import test from 'node:test'

test('Telegram Trello composition maps generated task into Trello card payload', async () => {
  process.env.NODE_ENV = 'test'
  process.env.LOG_LEVEL = 'silent'
  process.env.APP_TIMEZONE = 'Europe/Lisbon'
  process.env.APP_BASE_URL = 'https://bot.example'
  process.env.APP_PORT = '3000'
  process.env.TELEGRAM_BOT_TOKEN = '123456:test-token'
  process.env.TELEGRAM_BOT_USERNAME = 'taletrellerbot'
  process.env.TELEGRAM_BOT_URL = 'https://t.me/taletrellerbot'
  process.env.TRELLO_API_KEY = 'trello-key'
  process.env.TRELLO_API_SECRET = 'trello-secret'
  process.env.AUTH_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')
  process.env.AUTH_SESSION_TTL_MINUTES = '15'
  process.env.TRELLO_AUTH_TTL_DAYS = '30'
  process.env.DATABASE_URL = 'postgresql://example'
  process.env.LLM_API_KEY = 'llm-key'
  process.env.LLM_MODEL = 'test-model'

  const { TrelloCardPayloadMapper } = await import('../../src/infrastructure/trello/trello-card-payload-mapper.ts')

  const input = {
    telegramUserId: 42,
    text: 'Please prepare the launch checklist',
    currentDate: '2026-05-10T12:00:00+01:00',
    boardId: 'board-1',
    listId: 'list-1'
  }
  const context = {
    apiKey: 'key',
    token: 'token',
    memberId: 'member-1'
  }
  const generated = {
    name: 'Prepare launch checklist',
    desc: 'Checklist details',
    due: '2026-05-11T12:00:00.000Z',
    urlSource: 'https://example.com/source'
  }

  const mapper = new TrelloCardPayloadMapper()
  const payload = mapper.map({ input, generated, context })

  assert.equal(payload.idList, 'list-1')
  assert.equal(payload.pos, 'top')
  assert.equal(payload.name, generated.name)
  assert.equal(payload.due, generated.due)
  assert.equal(payload.urlSource, generated.urlSource)
  assert.match(payload.desc, /Task created with \[@taletrellerbot\]\(https:\/\/t\.me\/taletrellerbot\)\.$/)
})

test('CreateTrelloTask validates, resolves auth and generator, maps payload, and creates card', async () => {
  const { CreateTrelloTask } = await import('../../src/use-cases/trello/create-trello-task.ts')
  const { TrelloCardPayloadMapper } = await import('../../src/infrastructure/trello/trello-card-payload-mapper.ts')
  const calls: string[] = []
  const auth = { apiKey: 'key', token: 'token', memberId: 'member-1' }
  const input = {
    telegramUserId: 42,
    text: 'Please prepare the launch checklist',
    currentDate: '2026-05-10T12:00:00+01:00',
    boardId: 'board-1',
    listId: 'list-1'
  }
  const card = {
    id: 'card-1',
    name: 'Prepare launch checklist',
    desc: 'desc',
    url: 'https://trello/card',
    shortUrl: 'https://trello/c/1',
    idList: 'list-1',
    idBoard: 'board-1'
  }

  const useCase = new CreateTrelloTask(
    {
      validate(data) {
        calls.push('validate')
        assert.deepEqual(data, input)
        return { data: input, errors: [] }
      }
    },
    {
      async getActiveAuthContext(telegramUserId: number) {
        calls.push('auth')
        assert.equal(telegramUserId, 42)
        return auth
      }
    },
    {
      async resolve(params) {
        calls.push('resolve-generator')
        assert.deepEqual(params, { telegramUserId: 42, destinationId: 'trello' })
        return {
          async generateTask(generateInput) {
            calls.push('generate')
            assert.deepEqual(generateInput, {
              text: input.text,
              currentDate: input.currentDate
            })
            return {
              name: card.name,
              desc: 'Checklist details'
            }
          }
        }
      }
    },
    new TrelloCardPayloadMapper(),
    {
      async createCard(payload, actualAuth) {
        calls.push('create-card')
        assert.equal(payload.idList, 'list-1')
        assert.equal(payload.name, card.name)
        assert.deepEqual(actualAuth, auth)
        return card
      }
    }
  )

  assert.deepEqual(await useCase.call(input), card)
  assert.deepEqual(calls, ['validate', 'auth', 'resolve-generator', 'generate', 'create-card'])
})

test('CreateTrelloTask stops before generation when auth is missing', async () => {
  const { CreateTrelloTask } = await import('../../src/use-cases/trello/create-trello-task.ts')
  const { TrelloCardPayloadMapper } = await import('../../src/infrastructure/trello/trello-card-payload-mapper.ts')
  let generatorCalled = false
  const useCase = new CreateTrelloTask(
    {
      validate(data) {
        return { data, errors: [] }
      }
    },
    {
      async getActiveAuthContext() {
        return null
      }
    },
    {
      async resolve() {
        generatorCalled = true
        throw new Error('generator should not resolve')
      }
    },
    new TrelloCardPayloadMapper(),
    {
      async createCard() {
        throw new Error('card should not be created')
      }
    }
  )

  await assert.rejects(
    () => useCase.call({
      telegramUserId: 42,
      text: 'Please prepare the launch checklist',
      currentDate: '2026-05-10T12:00:00+01:00',
      boardId: 'board-1',
      listId: 'list-1'
    }),
    /Trello authorization is required/
  )
  assert.equal(generatorCalled, false)
})
