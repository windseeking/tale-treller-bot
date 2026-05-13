import type { BotRequest, SessionStorePort, TaskDestinationRegistry } from '#interfaces/bot.js'
import type { TelegramUsersRepositoryPort } from '#interfaces/telegram-user/telegram-users-repository.js'

export class BotStartController {
  public constructor(
    private readonly sessions: SessionStorePort,
    private readonly telegramUsersRepository: TelegramUsersRepositoryPort,
    private readonly destinations: TaskDestinationRegistry
  ) {}

  public async handle(request: BotRequest): Promise<void> {
    await this.telegramUsersRepository.upsert({
      telegramUserId: request.identity.telegramUserId,
      telegramChatId: request.identity.chatId
    })
    this.sessions.resetTask(request.identity.chatId)

    const welcome = await this.destinations.getDefault().getWelcomeResponse({
      identity: request.identity
    })
    await request.messenger.replyMarkdown(welcome.text, { reply_markup: welcome.replyMarkup })
  }
}
