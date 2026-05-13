import type { BotRequest, SessionStorePort, TaskDestinationRegistry } from '#interfaces/bot.js'
import type { TelegramUsersRepositoryPort } from '#interfaces/telegram-user/telegram-users-repository.js'
import { BOT_MESSAGES } from '../../presenters/bot/messages.js'

export class BotCallbackController {
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
    await request.messenger.answerCallbackQuery()

    const session = this.sessions.get(request.identity.chatId)
    const data = request.callbackData
    if (!data) {
      return
    }

    if (data === 'task:cancel') {
      this.sessions.resetTask(request.identity.chatId)
      await request.messenger.replyMarkdown(BOT_MESSAGES.canceled, {
        reply_markup: await this.destinations.getDefault().getMainReplyKeyboard({ identity: request.identity })
      })
      return
    }

    const destination =
      this.destinations.findByCallbackData(data) ??
      (session.destinationId ? this.destinations.findById(session.destinationId) : null)

    if (!destination) {
      await request.messenger.replyMarkdown(BOT_MESSAGES.unsupportedMessage)
      return
    }

    await destination.handleCallback(request, session)
  }
}
