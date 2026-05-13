export type UserSettings = {
  telegramUserId: number;
  values: Record<string, string | null>;
};

export type UserSetting = {
  telegramUserId: number;
  key: string;
  value: string | null;
};

export interface UserSettingsRepositoryPort {
  findValue(telegramUserId: number, key: string): Promise<string | null>;
  upsertValue(params: UserSetting): Promise<void>;
}
