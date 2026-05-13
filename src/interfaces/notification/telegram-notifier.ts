export interface TelegramNotifier {
  sendAuthSuccessNotification(params: { telegramUserId: number; telegramChatId: number }): Promise<void>;
  sendTimeZoneSetupPrompt(params: { telegramChatId: number }): Promise<void>;
}
