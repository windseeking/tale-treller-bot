import { createHmac } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'

const BOT_TOKEN = '123456:test-token'
const TEST_PORT = 45_731

test('protected App API rejects requests without Telegram initData', async () => {
  const { baseUrl, stop } = await startTestServer()
  try {
    const response = await fetch(`${baseUrl}/api/app/me`)

    assert.equal(response.status, 401)
  } finally {
    await stop()
  }
})

test('protected App API resolves user from signed Telegram initData', async () => {
  const { baseUrl, stop, saves } = await startTestServer()
  const initData = createSignedInitData({
    authDate: Math.floor(Date.now() / 1000),
    user: { id: 4242, first_name: 'Ada' }
  })

  try {
    const response = await fetch(`${baseUrl}/api/app/me`, {
      headers: {
        'X-Telegram-Init-Data': initData
      }
    })
    const payload = (await response.json()) as {
      ok: boolean;
      user: { telegramUserId: number; telegramChatId: number };
      trello: { connected: boolean; username: string | null };
      settings: { locale: string; defaultLocale: string; localeOptions: Array<{ value: string; label: string }> };
    }

    assert.equal(response.status, 200)
    assert.equal(payload.ok, true)
    assert.equal(payload.user.telegramUserId, 4242)
    assert.equal(payload.user.telegramChatId, 4242)
    assert.deepEqual(saves, [{ telegramUserId: 4242, telegramChatId: 4242 }])
    assert.equal(payload.trello.connected, true)
    assert.equal(payload.trello.username, 'ada-trello')
    assert.equal(payload.settings.locale, 'en')
    assert.equal(payload.settings.defaultLocale, 'en')
    assert.deepEqual(payload.settings.localeOptions.map((option) => option.value), ['en', 'ru'])
  } finally {
    await stop()
  }
})

test('locale save uses user from signed Telegram initData', async () => {
  const { baseUrl, stop, savedLocales } = await startTestServer()
  const initData = createSignedInitData({
    authDate: Math.floor(Date.now() / 1000),
    user: { id: 7171 }
  })

  try {
    const response = await fetch(`${baseUrl}/api/app/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initData
      },
      body: JSON.stringify({ locale: 'ru' })
    })

    assert.equal(response.status, 200)
    assert.deepEqual(savedLocales, [{ telegramUserId: 7171, locale: 'ru' }])
  } finally {
    await stop()
  }
})

test('locale save rejects unsupported locale', async () => {
  const { baseUrl, stop, savedLocales } = await startTestServer()
  const initData = createSignedInitData({
    authDate: Math.floor(Date.now() / 1000),
    user: { id: 8181 }
  })

  try {
    const response = await fetch(`${baseUrl}/api/app/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initData
      },
      body: JSON.stringify({ locale: 'de' })
    })

    assert.equal(response.status, 400)
    assert.deepEqual(savedLocales, [])
  } finally {
    await stop()
  }
})

test('timezone save uses user from signed Telegram initData', async () => {
  const { baseUrl, stop, savedTimeZones } = await startTestServer()
  const initData = createSignedInitData({
    authDate: Math.floor(Date.now() / 1000),
    user: { id: 5151 }
  })

  try {
    const response = await fetch(`${baseUrl}/api/app/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initData
      },
      body: JSON.stringify({ timeZone: 'Europe/Lisbon' })
    })

    assert.equal(response.status, 200)
    assert.deepEqual(savedTimeZones, [{ telegramUserId: 5151, timeZone: 'Europe/Lisbon' }])
  } finally {
    await stop()
  }
})

test('Trello disconnect uses user from signed Telegram initData', async () => {
  const { baseUrl, stop, revokedUsers } = await startTestServer()
  const initData = createSignedInitData({
    authDate: Math.floor(Date.now() / 1000),
    user: { id: 6262 }
  })

  try {
    const response = await fetch(`${baseUrl}/api/app/trello/disconnect`, {
      method: 'POST',
      headers: {
        'X-Telegram-Init-Data': initData
      }
    })

    assert.equal(response.status, 200)
    assert.deepEqual(revokedUsers, [6262])
  } finally {
    await stop()
  }
})

async function startTestServer() {
  process.env.NODE_ENV = 'test'
  process.env.LOG_LEVEL = 'silent'
  process.env.APP_TIMEZONE = 'Europe/Lisbon'
  process.env.APP_BASE_URL = `http://127.0.0.1:${TEST_PORT}`
  process.env.APP_PORT = String(TEST_PORT)
  process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
  process.env.TRELLO_API_KEY = 'trello-key'
  process.env.TRELLO_API_SECRET = 'trello-secret'
  process.env.AUTH_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')
  process.env.AUTH_SESSION_TTL_MINUTES = '15'
  process.env.TRELLO_AUTH_TTL_DAYS = '30'
  process.env.DATABASE_URL = 'postgresql://example'
  process.env.LLM_API_KEY = 'llm-key'
  process.env.LLM_MODEL = 'test-model'

  const { createHttpServer } = await import('../../src/http/server.ts')
  const saves: Array<{ telegramUserId: number; telegramChatId: number }> = []
  const savedTimeZones: Array<{ telegramUserId: number; timeZone: string }> = []
  const savedLocales: Array<{ telegramUserId: number; locale: string }> = []
  const revokedUsers: number[] = []
  const telegramUsersRepository = {
    findByTelegramUserId: async () => null,
    upsert: async (params: { telegramUserId: number; telegramChatId: number }) => {
      saves.push(params)
    }
  }
  const settingsService = {
    findTimeZone: async () => 'Europe/Lisbon',
    findLocale: async () => 'en',
    resolveLocale: async () => 'en',
    saveTimeZone: async (params: { telegramUserId: number; timeZone: string }) => {
      savedTimeZones.push(params)
    },
    saveLocale: async (params: { telegramUserId: number; locale: string }) => {
      savedLocales.push(params)
    }
  }
  const authService = {
    getConnectionStatus: async () => ({
      connected: true,
      username: 'ada-trello',
      expiresAt: new Date('2026-06-01T00:00:00.000Z'),
      expired: false
    }),
    createAuthorizationLink: async () => ({
      url: 'https://trello.example/connect',
      expiresAt: new Date('2026-05-06T13:00:00.000Z')
    }),
    revokeConnection: async (telegramUserId: number) => {
      revokedUsers.push(telegramUserId)
    },
    startAuthRedirect: async () => ({ ok: false, statusCode: 404, reason: 'unused' }),
    handleCallback: async () => ({ ok: false, reason: 'unused' })
  }

  const server = createHttpServer(authService, settingsService, telegramUsersRepository)
  await server.start()

  return {
    baseUrl: `http://127.0.0.1:${TEST_PORT}`,
    saves,
    savedTimeZones,
    savedLocales,
    revokedUsers,
    stop: server.stop
  }
}

function createSignedInitData(params: {
  authDate: number;
  user: Record<string, unknown>;
}): string {
  const searchParams = new URLSearchParams()
  searchParams.set('auth_date', String(params.authDate))
  searchParams.set('user', JSON.stringify(params.user))

  const dataCheckString = Array.from(searchParams.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  searchParams.set('hash', hash)

  return searchParams.toString()
}
