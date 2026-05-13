import type { Context } from 'telegraf'

import { normalizeError } from '../../errors/error-handler.js'
import { logger } from '../logger/logger.js'
import type { BotMessageOptions, BotMessenger, BotSentMessage } from '#interfaces/bot.js'

export class TelegrafBotMessenger implements BotMessenger {
  public constructor(private readonly ctx: Context) {}

  public async replyMarkdown(text: string, options?: BotMessageOptions): Promise<BotSentMessage> {
    const message = await this.ctx.reply(text, {
      parse_mode: 'Markdown',
      ...options
    } as Parameters<Context['reply']>[1])

    return { messageId: message.message_id }
  }

  public async answerCallbackQuery(): Promise<void> {
    try {
      await this.ctx.answerCbQuery()
    } catch (error) {
      const normalized = normalizeError(error)
      const message = normalized.message.toLowerCase()
      const isExpiredQuery =
        message.includes('query is too old') || message.includes('query id is invalid')

      if (!isExpiredQuery) {
        throw error
      }
    }
  }

  public async replaceCallbackMessageText(text: string, options?: BotMessageOptions): Promise<void> {
    try {
      await this.ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...options
      } as Parameters<Context['editMessageText']>[1])
    } catch (error) {
      const normalized = normalizeError(error)
      const message = normalized.message.toLowerCase()
      const isIgnorableError =
        message.includes('message is not modified') ||
        message.includes('message to edit not found') ||
        message.includes('message identifier is not specified') ||
        message.includes('message can\'t be edited')

      if (!isIgnorableError) {
        throw error
      }

      await this.replyMarkdown(text, options)
    }
  }

  public async replaceBotMessageText(
    messageId: number,
    text: string,
    options?: BotMessageOptions
  ): Promise<void> {
    const chatId = this.ctx.chat?.id
    if (chatId === undefined) {
      await this.replyMarkdown(text, options)
      return
    }

    try {
      await this.ctx.telegram.editMessageText(chatId, messageId, undefined, text, {
        parse_mode: 'Markdown',
        ...options
      } as Parameters<Context['telegram']['editMessageText']>[4])
    } catch (error) {
      const normalized = normalizeError(error)
      const message = normalized.message.toLowerCase()
      const isIgnorableError =
        message.includes('message is not modified') ||
        message.includes('message to edit not found') ||
        message.includes('message can\'t be edited')

      if (isIgnorableError) {
        return
      }

      await this.replyMarkdown(text, options)
    }
  }

  public async tryDeleteIncomingMessage(): Promise<void> {
    try {
      await this.ctx.deleteMessage()
    } catch (error) {
      const normalized = normalizeError(error)
      const message = normalized.message.toLowerCase()
      const isIgnorableError =
        message.includes('message to delete not found') ||
        message.includes('message can\'t be deleted') ||
        message.includes('message can\'t be deleted for everyone')

      if (isIgnorableError) {
        return
      }

      logger.warn(
        {
          code: normalized.code,
          message: normalized.message
        },
        'Could not delete incoming message'
      )
    }
  }

  public async hideMainReplyKeyboard(): Promise<void> {
    try {
      const chatId = this.ctx.chat?.id
      const markerMessage = await this.ctx.reply('\u2063', {
        reply_markup: { remove_keyboard: true }
      })

      if (chatId === undefined) {
        return
      }

      try {
        await this.ctx.telegram.deleteMessage(chatId, markerMessage.message_id)
      } catch {
        // Ignore cleanup errors: keyboard is already removed at this point.
      }
    } catch (error) {
      const normalized = normalizeError(error)
      logger.warn(
        {
          code: normalized.code,
          message: normalized.message
        },
        'Could not hide main reply keyboard'
      )
    }
  }
}
