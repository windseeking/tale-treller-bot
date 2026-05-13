export type TrelloAuthSessionStatus = 'pending' | 'redirected' | 'completed' | 'failed' | 'expired';

export type TrelloAuthSessionRecord = {
  id: string;
  telegramUserId: number;
  telegramChatId: number;
  sessionSecretHash: string;
  requestTokenEncrypted: string | null;
  requestTokenSecretEncrypted: string | null;
  status: TrelloAuthSessionStatus;
  expiresAt: Date;
};

export interface AuthSessionsRepository {
  create(params: {
    id: string;
    telegramUserId: number;
    telegramChatId: number;
    sessionSecretHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findById(id: string): Promise<TrelloAuthSessionRecord | null>;
  updateRedirected(params: {
    id: string;
    requestTokenEncrypted: string;
    requestTokenSecretEncrypted: string;
  }): Promise<void>;
  updateStatus(id: string, status: TrelloAuthSessionStatus): Promise<void>;
  markExpired(): Promise<void>;
  failPendingByTelegramUser(telegramUserId: number): Promise<void>;
}
