export type TrelloConnectionStatus = "active" | "revoked";
export type TrelloAuthSessionStatus = "pending" | "redirected" | "completed" | "failed" | "expired";

export type TelegramUser = {
  telegramUserId: number;
  telegramChatId: number;
};

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
