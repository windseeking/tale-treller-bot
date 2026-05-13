import type { TrelloConnection } from '#interfaces/trello/auth/connections-repository.js'
import type { DisconnectTrelloAccount } from '#usecases/trello/auth/disconnect-trello-account.js'
import type { GetTrelloConnectionStatus } from '#usecases/trello/auth/get-trello-connection-status.js'
import type { InitiateTrelloConnection } from '#usecases/trello/auth/initiate-trello-connection.js'

export class TrelloController {
  public constructor(
    private readonly getTrelloConnectionStatus: GetTrelloConnectionStatus,
    private readonly initiateTrelloConnection: InitiateTrelloConnection,
    private readonly disconnectTrelloAccount: DisconnectTrelloAccount
  ) {}

  public async getStatus(telegramUserId: number): Promise<TrelloConnection> {
    const status = await this.getTrelloConnectionStatus.call(telegramUserId)

    return {
      connected: status.connected,
      username: status.username ?? null,
      expiresAt: status.expiresAt?.toISOString() ?? null,
      expired: Boolean(status.expired)
    }
  }

  public async createConnectLink(params: {
    telegramUserId: number;
    telegramChatId: number;
  }): Promise<{ url: string; expiresAt: string }> {
    const link = await this.initiateTrelloConnection.call(params)

    return {
      url: link.url,
      expiresAt: link.expiresAt.toISOString()
    }
  }

  public async disconnect(telegramUserId: number): Promise<TrelloConnection> {
    await this.disconnectTrelloAccount.call(telegramUserId)
    return this.getStatus(telegramUserId)
  }
}
