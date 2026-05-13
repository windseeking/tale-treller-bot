import type { Clock } from '#interfaces/clock.js'
import type { TrelloAuthContext, TrelloAuthContextProvider } from '#interfaces/trello/auth/trello-auth-context.js'
import type { ConnectionsRepository } from '#interfaces/trello/auth/connections-repository.js'
import type { TrelloAuthSecrets } from '#interfaces/trello/auth/trello-auth-secrets.js'

export class RepositoryTrelloAuthContextProvider implements TrelloAuthContextProvider {
  public constructor(
    private readonly connectionsRepository: ConnectionsRepository,
    private readonly secrets: TrelloAuthSecrets,
    private readonly clock: Clock
  ) {}

  public async getActiveAuthContext(telegramUserId: number): Promise<TrelloAuthContext | null> {
    const connection = await this.connectionsRepository.findByTelegramUserId(telegramUserId)

    if (!connection || connection.status !== 'active' || connection.revokedAt) {
      return null
    }

    if (connection.tokenExpiresAt.getTime() <= this.clock.now().getTime()) {
      return null
    }

    return {
      apiKey: this.secrets.decryptString(connection.trelloApiKeyEncrypted),
      token: this.secrets.decryptString(connection.trelloTokenEncrypted),
      memberId: connection.trelloMemberId
    }
  }
}
