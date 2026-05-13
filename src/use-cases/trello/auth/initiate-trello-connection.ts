import { randomUUID } from 'node:crypto'

import type { Clock } from '#interfaces/clock.js'
import type { TelegramUsersRepositoryPort } from '#interfaces/telegram-user/telegram-users-repository.js'
import type { AuthSessionsRepository } from '#interfaces/trello/auth/auth-sessions-repository.js'
import type { TrelloAuthConfig } from '#interfaces/trello/auth/trello-auth-config.js'
import type { TrelloAuthSecrets } from '#interfaces/trello/auth/trello-auth-secrets.js'
import type { StartAuthorizationResult } from '#interfaces/trello/auth/trello-auth-results.js'

export class InitiateTrelloConnection {
  public constructor(
    private readonly telegramUsersRepository: TelegramUsersRepositoryPort,
    private readonly authSessionsRepository: AuthSessionsRepository,
    private readonly secrets: TrelloAuthSecrets,
    private readonly clock: Clock,
    private readonly config: TrelloAuthConfig
  ) {}

  public async call(params: {
    telegramUserId: number;
    telegramChatId: number;
  }): Promise<StartAuthorizationResult> {
    await this.telegramUsersRepository.upsert({
      telegramUserId: params.telegramUserId,
      telegramChatId: params.telegramChatId
    })

    await this.authSessionsRepository.markExpired()
    await this.authSessionsRepository.failPendingByTelegramUser(params.telegramUserId)

    const sid = randomUUID()
    const secret = this.secrets.generateOpaqueSecret()
    const expiresAt = new Date(this.clock.now().getTime() + this.config.authSessionTtlMinutes * 60 * 1000)

    await this.authSessionsRepository.create({
      id: sid,
      telegramUserId: params.telegramUserId,
      telegramChatId: params.telegramChatId,
      sessionSecretHash: this.secrets.hashSecret(secret),
      expiresAt
    })

    const baseUrl = new URL('/auth/trello/start', this.config.appBaseUrl)
    baseUrl.searchParams.set('sid', sid)
    baseUrl.searchParams.set('secret', secret)

    return {
      sid,
      secret,
      url: baseUrl.toString(),
      expiresAt
    }
  }
}
