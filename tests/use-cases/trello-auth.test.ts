import assert from 'node:assert/strict'
import test from 'node:test'

import { ConnectTrelloAccount } from '../../src/use-cases/trello/auth/connect-trello-account.ts'
import { DisconnectTrelloAccount } from '../../src/use-cases/trello/auth/disconnect-trello-account.ts'
import { GetTrelloConnectionStatus } from '../../src/use-cases/trello/auth/get-trello-connection-status.ts'
import { InitiateTrelloConnection } from '../../src/use-cases/trello/auth/initiate-trello-connection.ts'
import { RepositoryTrelloAuthContextProvider } from '../../src/application/trello/auth/repository-trello-auth-context-provider.ts'
import { TrelloOAuthRedirectService } from '../../src/application/trello/auth/trello-oauth-redirect-service.ts'
import { presentTrelloAuthMessage, presentTrelloAuthStartStatusCode } from '../../src/controllers/trello/trello-auth-result-presenter.ts'
import { TrelloMemberHttpGateway } from '../../src/infrastructure/trello/auth/trello-oauth-gateway.ts'
import type { TrelloAuthSessionRecord, TrelloAuthSessionStatus } from '../../src/interfaces/trello/auth/auth-sessions-repository.ts'
import type { TrelloConnectionRecord } from '../../src/interfaces/trello/auth/connections-repository.ts'
import type { TrelloAuthResultCode } from '../../src/interfaces/trello/auth/trello-auth-results.ts'

const now = new Date('2026-05-13T10:00:00.000Z')
const config = {
  appBaseUrl: 'https://bot.example',
  authSessionTtlMinutes: 15,
  trelloAuthTtlDays: 30,
  trelloApiKey: 'trello-key'
}

test('InitiateTrelloConnection creates one-time session and connect link', async () => {
  const sessions = new FakeAuthSessionsRepository()
  const users: Array<{ telegramUserId: number; telegramChatId: number }> = []
  const useCase = new InitiateTrelloConnection(
    {
      async upsert(params) {
        users.push(params)
      },
      async findByTelegramUserId() {
        return null
      }
    },
    sessions,
    fakeSecrets,
    fakeClock,
    config
  )

  const result = await useCase.call({ telegramUserId: 42, telegramChatId: 43 })

  assert.deepEqual(users, [{ telegramUserId: 42, telegramChatId: 43 }])
  assert.equal(sessions.markExpiredCalls, 1)
  assert.deepEqual(sessions.failedUsers, [42])
  assert.equal(sessions.created.length, 1)
  assert.equal(sessions.created[0]?.telegramUserId, 42)
  assert.equal(sessions.created[0]?.telegramChatId, 43)
  assert.equal(sessions.created[0]?.sessionSecretHash, 'hash:opaque-secret')
  assert.equal(result.secret, 'opaque-secret')
  assert.equal(result.expiresAt.toISOString(), '2026-05-13T10:15:00.000Z')
  assert.match(result.url, /^https:\/\/bot\.example\/auth\/trello\/start\?sid=/)
  assert.match(result.url, /secret=opaque-secret/)
})

test('TrelloOAuthRedirectService rejects invalid secret before requesting Trello token', async () => {
  const sessions = new FakeAuthSessionsRepository()
  sessions.records.set('sid-1', {
    id: 'sid-1',
    telegramUserId: 42,
    telegramChatId: 43,
    sessionSecretHash: 'hash:expected',
    requestTokenEncrypted: null,
    requestTokenSecretEncrypted: null,
    status: 'pending',
    expiresAt: new Date('2026-05-13T10:15:00.000Z')
  })
  let tokenRequested = false

  const flow = new TrelloOAuthRedirectService(
    sessions,
    {
      async getRequestToken() {
        tokenRequested = true
        return { requestToken: 'request-token', requestTokenSecret: 'request-secret' }
      },
      async getAccessToken() {
        throw new Error('unused')
      },
      buildAuthorizeUrl() {
        return 'https://trello.example/auth'
      }
    },
    fakeSecrets,
    fakeClock,
    config
  )

  const result = await flow.startRedirect({ sid: 'sid-1', secret: 'wrong' })

  assert.deepEqual(result, {
    ok: false,
    code: 'SESSION_SECRET_INVALID'
  })
  assert.equal(tokenRequested, false)
})

test('ConnectTrelloAccount stores connection, timezone, and completion notifications', async () => {
  const sessions = new FakeAuthSessionsRepository()
  sessions.records.set('sid-1', {
    id: 'sid-1',
    telegramUserId: 42,
    telegramChatId: 43,
    sessionSecretHash: 'hash:secret',
    requestTokenEncrypted: 'enc:request-token',
    requestTokenSecretEncrypted: 'enc:request-secret',
    status: 'redirected',
    expiresAt: new Date('2026-05-13T10:15:00.000Z')
  })
  const connections = new FakeConnectionsRepository()
  const savedTimeZones: Array<{ telegramUserId: number; timeZone: string | null }> = []
  const notifications: string[] = []

  const useCase = new ConnectTrelloAccount(
    {
      async upsert() {},
      async findByTelegramUserId() {
        return null
      }
    },
    connections,
    sessions,
    {
      async findTimeZone() {
        return null
      },
      async upsertTimeZone(params) {
        savedTimeZones.push(params)
      }
    },
    {
      async getRequestToken() {
        throw new Error('unused')
      },
      async getAccessToken(params) {
        assert.deepEqual(params, {
          oauthToken: 'request-token',
          oauthVerifier: 'verifier',
          requestTokenSecret: 'request-secret'
        })
        return { accessToken: 'access-token' }
      },
      buildAuthorizeUrl() {
        return 'unused'
      }
    },
    {
      async getMemberProfile() {
        return {
          id: 'member-1',
          username: 'trello-user',
          timeZone: 'Europe/Lisbon'
        }
      }
    },
    fakeSecrets,
    { isValid: (timeZone) => timeZone === 'Europe/Lisbon' },
    fakeClock,
    config,
    {
      async sendAuthSuccessNotification() {
        notifications.push('auth')
      },
      async sendTimeZoneSetupPrompt() {
        notifications.push('timezone')
      }
    }
  )

  const result = await useCase.call({
    sid: 'sid-1',
    oauthToken: 'request-token',
    oauthVerifier: 'verifier'
  })

  assert.deepEqual(result, { ok: true, code: 'CONNECTED' })
  assert.deepEqual(savedTimeZones, [{ telegramUserId: 42, timeZone: 'Europe/Lisbon' }])
  assert.deepEqual(notifications, ['auth'])
  assert.equal(sessions.statuses.get('sid-1'), 'completed')
  assert.equal(connections.upserts[0]?.trelloMemberId, 'member-1')
  assert.equal(connections.upserts[0]?.trelloUsername, 'trello-user')
  assert.equal(connections.upserts[0]?.trelloApiKeyEncrypted, 'enc:trello-key')
  assert.equal(connections.upserts[0]?.trelloTokenEncrypted, 'enc:access-token')
  assert.equal(connections.upserts[0]?.tokenExpiresAt.toISOString(), '2026-06-12T10:00:00.000Z')
})

test('ConnectTrelloAccount ignores unapproved Trello timezone candidates', async () => {
  const sessions = new FakeAuthSessionsRepository()
  sessions.records.set('sid-1', {
    id: 'sid-1',
    telegramUserId: 42,
    telegramChatId: 43,
    sessionSecretHash: 'hash:secret',
    requestTokenEncrypted: 'enc:request-token',
    requestTokenSecretEncrypted: 'enc:request-secret',
    status: 'redirected',
    expiresAt: new Date('2026-05-13T10:15:00.000Z')
  })
  const savedTimeZones: Array<{ telegramUserId: number; timeZone: string | null }> = []
  const notifications: string[] = []

  const useCase = new ConnectTrelloAccount(
    {
      async upsert() {},
      async findByTelegramUserId() {
        return null
      }
    },
    new FakeConnectionsRepository(),
    sessions,
    {
      async findTimeZone() {
        return null
      },
      async upsertTimeZone(params) {
        savedTimeZones.push(params)
      }
    },
    {
      async getRequestToken() {
        throw new Error('unused')
      },
      async getAccessToken() {
        return { accessToken: 'access-token' }
      },
      buildAuthorizeUrl() {
        return 'unused'
      }
    },
    {
      async getMemberProfile() {
        return {
          id: 'member-1',
          username: 'trello-user',
          timeZone: 'Mars/Olympus'
        }
      }
    },
    fakeSecrets,
    { isValid: (timeZone) => timeZone === 'Europe/Lisbon' },
    fakeClock,
    config,
    {
      async sendAuthSuccessNotification() {
        notifications.push('auth')
      },
      async sendTimeZoneSetupPrompt() {
        notifications.push('timezone')
      }
    }
  )

  assert.deepEqual(await useCase.call({
    sid: 'sid-1',
    oauthToken: 'request-token',
    oauthVerifier: 'verifier'
  }), { ok: true, code: 'CONNECTED' })
  assert.deepEqual(savedTimeZones, [])
  assert.deepEqual(notifications, ['auth', 'timezone'])
})

test('DisconnectTrelloAccount revokes connection and fails pending sessions', async () => {
  const sessions = new FakeAuthSessionsRepository()
  const connections = new FakeConnectionsRepository()
  const useCase = new DisconnectTrelloAccount(connections, sessions)

  await useCase.call(42)

  assert.deepEqual(connections.revokedUsers, [42])
  assert.deepEqual(sessions.failedUsers, [42])
})

test('Trello auth presenter maps result codes to existing messages and OAuth start statuses', () => {
  const messages: Record<TrelloAuthResultCode, string> = {
    SESSION_NOT_FOUND: 'Сессия авторизации не найдена.',
    SESSION_ALREADY_USED: 'Ссылка уже использована. Вернитесь в Telegram и запустите подключение Trello ещё раз.',
    SESSION_EXPIRED: 'Сессия авторизации истекла. Запустите подключение снова.',
    SESSION_SECRET_INVALID: 'Неверный секрет сессии.',
    SESSION_STATUS_INVALID: 'Некорректный статус сессии. Запустите подключение заново.',
    USER_DENIED: 'Вы отменили подключение Trello.',
    MISSING_CALLBACK_PARAMS: 'Callback Trello не содержит обязательные параметры.',
    TOKEN_MISMATCH: 'Токен сессии не совпадает. Запустите подключение заново.',
    CONNECTED: 'Trello подключен. Можно возвращаться в Telegram.'
  }

  for (const [code, message] of Object.entries(messages) as Array<[TrelloAuthResultCode, string]>) {
    assert.equal(presentTrelloAuthMessage(code), message)
  }

  assert.equal(presentTrelloAuthStartStatusCode('SESSION_NOT_FOUND'), 404)
  assert.equal(presentTrelloAuthStartStatusCode('SESSION_ALREADY_USED'), 409)
  assert.equal(presentTrelloAuthStartStatusCode('SESSION_EXPIRED'), 410)
  assert.equal(presentTrelloAuthStartStatusCode('SESSION_SECRET_INVALID'), 403)
  assert.equal(presentTrelloAuthStartStatusCode('SESSION_STATUS_INVALID'), 400)
})

test('TrelloMemberHttpGateway extracts timezone from Trello prefs timezone field', async () => {
  const restoreFetch = mockFetchJson({
    id: 'member-1',
    username: 'trello-user',
    prefs: { timezone: 'Europe/Lisbon' }
  })
  try {
    const profile = await new TrelloMemberHttpGateway('api-key').getMemberProfile('token')

    assert.equal(profile.timeZone, 'Europe/Lisbon')
  } finally {
    restoreFetch()
  }
})

test('TrelloMemberHttpGateway extracts timezone from Trello prefs timezoneInfo field', async () => {
  const restoreFetch = mockFetchJson({
    id: 'member-1',
    username: 'trello-user',
    prefs: { timezoneInfo: { timezone: 'America/New_York' } }
  })
  try {
    const profile = await new TrelloMemberHttpGateway('api-key').getMemberProfile('token')

    assert.equal(profile.timeZone, 'America/New_York')
  } finally {
    restoreFetch()
  }
})

test('status query and auth context provider keep auth guard behavior outside product use cases', async () => {
  const connections = new FakeConnectionsRepository()
  connections.record = {
    telegramUserId: 42,
    trelloMemberId: 'member-1',
    trelloUsername: 'trello-user',
    trelloApiKeyEncrypted: 'enc:key',
    trelloTokenEncrypted: 'enc:token',
    tokenExpiresAt: new Date('2026-05-13T10:30:00.000Z'),
    status: 'active',
    revokedAt: null
  }

  const status = await new GetTrelloConnectionStatus(connections, fakeClock).call(42)
  const context = await new RepositoryTrelloAuthContextProvider(connections, fakeSecrets, fakeClock)
    .getActiveAuthContext(42)

  assert.deepEqual(status, {
    connected: true,
    username: 'trello-user',
    expiresAt: new Date('2026-05-13T10:30:00.000Z'),
    expired: false
  })
  assert.deepEqual(context, {
    apiKey: 'key',
    token: 'token',
    memberId: 'member-1'
  })
})

const fakeClock = {
  now() {
    return now
  }
}

const fakeSecrets = {
  generateOpaqueSecret() {
    return 'opaque-secret'
  },
  hashSecret(secret: string) {
    return `hash:${secret}`
  },
  isSecretHashMatch(params: { secret: string; hash: string }) {
    return params.hash === `hash:${params.secret}`
  },
  encryptString(value: string) {
    return `enc:${value}`
  },
  decryptString(value: string) {
    return value.replace(/^enc:/, '')
  }
}

class FakeAuthSessionsRepository {
  public readonly records = new Map<string, TrelloAuthSessionRecord>()
  public readonly statuses = new Map<string, TrelloAuthSessionStatus>()
  public readonly created: Array<{
    id: string;
    telegramUserId: number;
    telegramChatId: number;
    sessionSecretHash: string;
    expiresAt: Date;
  }> = []
  public readonly failedUsers: number[] = []
  public markExpiredCalls = 0

  public async create(params: {
    id: string;
    telegramUserId: number;
    telegramChatId: number;
    sessionSecretHash: string;
    expiresAt: Date;
  }): Promise<void> {
    this.created.push(params)
  }

  public async findById(id: string): Promise<TrelloAuthSessionRecord | null> {
    return this.records.get(id) ?? null
  }

  public async updateRedirected(params: {
    id: string;
    requestTokenEncrypted: string;
    requestTokenSecretEncrypted: string;
  }): Promise<void> {
    this.statuses.set(params.id, 'redirected')
  }

  public async updateStatus(id: string, status: TrelloAuthSessionStatus): Promise<void> {
    this.statuses.set(id, status)
  }

  public async markExpired(): Promise<void> {
    this.markExpiredCalls += 1
  }

  public async failPendingByTelegramUser(telegramUserId: number): Promise<void> {
    this.failedUsers.push(telegramUserId)
  }
}

class FakeConnectionsRepository {
  public record: TrelloConnectionRecord | null = null
  public readonly upserts: Array<{
    telegramUserId: number;
    trelloMemberId: string;
    trelloUsername: string;
    trelloApiKeyEncrypted: string;
    trelloTokenEncrypted: string;
    tokenExpiresAt: Date;
  }> = []
  public readonly revokedUsers: number[] = []

  public async upsertActive(params: {
    telegramUserId: number;
    trelloMemberId: string;
    trelloUsername: string;
    trelloApiKeyEncrypted: string;
    trelloTokenEncrypted: string;
    tokenExpiresAt: Date;
  }): Promise<void> {
    this.upserts.push(params)
  }

  public async findByTelegramUserId(): Promise<TrelloConnectionRecord | null> {
    return this.record
  }

  public async revoke(telegramUserId: number): Promise<void> {
    this.revokedUsers.push(telegramUserId)
  }
}

function mockFetchJson(payload: unknown): () => void {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })

  return () => {
    globalThis.fetch = originalFetch
  }
}
