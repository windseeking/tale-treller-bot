export type TrelloConnectionStatus = "active" | "revoked";
export type TrelloAuthSessionStatus = "pending" | "redirected" | "completed" | "failed" | "expired";

export type TelegramUser = {
  telegramUserId: number;
  telegramChatId: number;
};

export type UserSettings = {
  telegramUserId: number;
  values: Record<string, string | null>;
};

export type UserSetting = {
  telegramUserId: number;
  key: string;
  value: string | null;
};

export type SettingsUpdateSessionStatus = "pending" | "completed" | "failed" | "expired";
export type SettingsUpdateSessionPurpose = "time_zone_auto";
export type AppSessionStatus = "pending" | "active" | "expired";

export type SettingsUpdateSessionRecord = {
  id: string;
  telegramUserId: number;
  telegramChatId: number;
  purpose: SettingsUpdateSessionPurpose;
  sessionSecretHash: string;
  status: SettingsUpdateSessionStatus;
  expiresAt: Date;
};

export type AppSessionRecord = {
  id: string;
  telegramUserId: number;
  telegramChatId: number;
  sessionSecretHash: string;
  apiTokenHash: string | null;
  status: AppSessionStatus;
  expiresAt: Date;
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
