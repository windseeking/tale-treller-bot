import type { BotRequest, SessionStorePort, TaskDestinationRegistry } from '#interfaces/bot.js'
import type { TelegramUsersRepositoryPort } from '#interfaces/telegram-user/telegram-users-repository.js'
import { ValidateDraft } from '#usecases/task/validate-draft.js'
import { resolveBotAction } from '@bot/actions.js'
import { BOT_MESSAGES } from '../../presenters/bot/messages.js'

export class BotTextController {
  public constructor(
    private readonly sessions: SessionStorePort,
    private readonly telegramUsersRepository: TelegramUsersRepositoryPort,
    private readonly validateDraft: ValidateDraft,
    private readonly destinations: TaskDestinationRegistry
  ) {}

  public async handle(request: BotRequest): Promise<void> {
    await this.telegramUsersRepository.upsert({
      telegramUserId: request.identity.telegramUserId,
      telegramChatId: request.identity.chatId
    })

    const text = request.body?.text?.trim()
    if (!text) {
      return
    }

    const action = resolveBotAction(text)
    const session = this.sessions.get(request.identity.chatId)
    const normalizedRequest: BotRequest = { ...request, action, body: { text } }

    if (action) {
      const destination = this.destinations.findByAction(action)
      if (destination) {
        await destination.handleAction(normalizedRequest, session)
        return
      }
    }

    if (session.stage === 'destination_flow' && session.destinationId) {
      const destination = this.destinations.findById(session.destinationId)
      if (destination) {
        await destination.handleTextDuringFlow(normalizedRequest, session)
        return
      }
    }

    if (action === 'task:cancel') {
      await request.messenger.tryDeleteIncomingMessage()
      this.sessions.resetTask(request.identity.chatId)
      await request.messenger.replyMarkdown(BOT_MESSAGES.canceled, {
        reply_markup: await this.destinations.getDefault().getMainReplyKeyboard({ identity: request.identity })
      })
      return
    }

    if (action === 'task:create') {
      await this.handleCreateTask(normalizedRequest)
      return
    }

    session.messages.push(text)
  }

  private async handleCreateTask(request: BotRequest): Promise<void> {
    const session = this.sessions.get(request.identity.chatId)

    await request.messenger.tryDeleteIncomingMessage()
    await request.messenger.hideMainReplyKeyboard()
    const validation = this.validateDraft.call({ messages: session.messages })

    if (!validation.ok) {
      const message =
        validation.reason === 'empty'
          ? BOT_MESSAGES.draftEmpty
          : BOT_MESSAGES.tooShort(validation.currentLength)
      await request.messenger.replyMarkdown(message, {
        reply_markup: await this.destinations.getDefault().getMainReplyKeyboard({ identity: request.identity })
      })
      return
    }

    session.draftText = validation.draftText
    await this.destinations.getDefault().beginTaskCreation(request, session)
  }
}
