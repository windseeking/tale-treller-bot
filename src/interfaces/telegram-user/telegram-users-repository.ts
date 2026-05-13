export type TelegramUser = {
  telegramUserId: number;
  telegramChatId: number;
};

export interface TelegramUsersRepositoryPort {
  upsert(params: TelegramUser): Promise<void>;
  findByTelegramUserId(telegramUserId: number): Promise<TelegramUser | null>;
}
