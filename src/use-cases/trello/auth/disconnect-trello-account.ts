import type { AuthSessionsRepository } from '#interfaces/trello/auth/auth-sessions-repository.js'
import type { ConnectionsRepository } from '#interfaces/trello/auth/connections-repository.js'

export class DisconnectTrelloAccount {
  public constructor(
    private readonly connectionsRepository: ConnectionsRepository,
    private readonly authSessionsRepository: AuthSessionsRepository
  ) {}

  public async call(telegramUserId: number): Promise<void> {
    await this.connectionsRepository.revoke(telegramUserId)
    await this.authSessionsRepository.failPendingByTelegramUser(telegramUserId)
  }
}
