export type TrelloConnection = {
  connected: boolean;
  username: string | null;
  expiresAt: string | null;
  expired: boolean;
};

export type TrelloConnectionStatus = 'active' | 'revoked';

export type TrelloConnectionRecord = {
  telegramUserId: number;
  trelloMemberId: string;
  trelloUsername: string;
  trelloApiKeyEncrypted: string;
  trelloTokenEncrypted: string;
  tokenExpiresAt: Date;
  status: TrelloConnectionStatus;
  revokedAt: Date | null;
};

export interface ConnectionsRepository {
  upsertActive(params: {
    telegramUserId: number;
    trelloMemberId: string;
    trelloUsername: string;
    trelloApiKeyEncrypted: string;
    trelloTokenEncrypted: string;
    tokenExpiresAt: Date;
  }): Promise<void>;
  findByTelegramUserId(telegramUserId: number): Promise<TrelloConnectionRecord | null>;
  revoke(telegramUserId: number): Promise<void>;
}
