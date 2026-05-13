import type { Clock } from '#interfaces/clock.js'
import type { ConnectionsRepository } from '#interfaces/trello/auth/connections-repository.js'
import type { TrelloConnectionStatusResult } from '#interfaces/trello/auth/trello-auth-results.js'

export class GetTrelloConnectionStatus {
  public constructor(
    private readonly connectionsRepository: ConnectionsRepository,
    private readonly clock: Clock
  ) {}

  public async call(telegramUserId: number): Promise<TrelloConnectionStatusResult> {
    const connection = await this.connectionsRepository.findByTelegramUserId(telegramUserId)

    if (!connection || connection.status !== 'active' || connection.revokedAt) {
      return { connected: false }
    }

    const expired = connection.tokenExpiresAt.getTime() <= this.clock.now().getTime()

    return {
      connected: !expired,
      username: connection.trelloUsername,
      expiresAt: connection.tokenExpiresAt,
      expired
    }
  }
}
