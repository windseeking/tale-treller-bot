import type { TelegramNotifier } from '../../interfaces/notification/telegram-notifier.js'
import { env } from '../../config/env.js'
import { normalizeError, toLogPayload } from '../../errors/error-handler.js'
import { logger } from '../logger/logger.js'
import { authorizedReplyKeyboard } from '../../presenters/bot/keyboards.js'
import { BOT_MESSAGES } from '../../presenters/bot/messages.js'

export class TelegramBotNotifier implements TelegramNotifier {
  public async sendAuthSuccessNotification(params: {
    telegramUserId: number;
    telegramChatId: number;
  }): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: params.telegramChatId,
          text: BOT_MESSAGES.authServiceConnectedNotification,
          reply_markup: authorizedReplyKeyboard()
        })
      })
    } catch (error) {
      const normalized = normalizeError(error)
      logger.warn(toLogPayload(normalized, { scope: 'telegram', action: 'sendAuthSuccessNotification' }))
    }
  }

  public async sendTimeZoneSetupPrompt(params: { telegramChatId: number }): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: params.telegramChatId,
          text: BOT_MESSAGES.timeZoneSetupIntro
        })
      })
    } catch (error) {
      const normalized = normalizeError(error)
      logger.warn(toLogPayload(normalized, { scope: 'telegram', action: 'sendTimeZoneSetupPrompt' }))
    }
  }
}
