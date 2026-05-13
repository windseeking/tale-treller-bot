import { Telegraf, type Context } from 'telegraf'

import type { BotIdentity } from '#interfaces/bot.js'
import { BotCallbackController } from '#controllers/bot/callback-controller.js'
import { BotStartController } from '#controllers/bot/start-controller.js'
import { BotTextController } from '#controllers/bot/text-controller.js'
import { normalizeError } from '#errors/error-handler.js'
import { formatBotError } from '../../presenters/bot/errors.js'
import { logger } from '../logger/logger.js'
import { BOT_MESSAGES } from '@presenters/bot/messages.js'
import { TelegrafBotMessenger } from './telegram-messenger.js'

type Dependencies = {
  telegramToken: string;
  startController: BotStartController;
  textController: BotTextController;
  callbackController: BotCallbackController;
};

export function createTelegramBot({
  telegramToken,
  startController,
  textController,
  callbackController
}: Dependencies): Telegraf {
  const bot = new Telegraf(telegramToken)

  bot.start(async (ctx: Context) => {
    await handleTelegramError(ctx, 'Telegram start handling failed', async () => {
      const identity = resolveIdentity(ctx)
      if (!identity) {
        return
      }

      await startController.handle({
        identity,
        messenger: new TelegrafBotMessenger(ctx)
      })
    })
  })

  bot.on('text', async (ctx: Context) => {
    await handleTelegramError(ctx, 'Telegram text handling failed', async () => {
      const identity = resolveIdentity(ctx)
      if (!identity) {
        return
      }

      const message = ctx.message
      if (!message || !('text' in message)) {
        return
      }

      await textController.handle({
        identity,
        messenger: new TelegrafBotMessenger(ctx),
        body: { text: message.text }
      })
    })
  })

  bot.on('message', async (ctx: Context, next: () => Promise<void>) => {
    const message = ctx.message
    if (message && 'text' in message) {
      await next()
      return
    }
    await new TelegrafBotMessenger(ctx).replyMarkdown(BOT_MESSAGES.unsupportedMessage)
  })

  bot.on('callback_query', async (ctx: Context) => {
    await handleTelegramError(ctx, 'Telegram callback handling failed', async () => {
      const callbackQuery = ctx.callbackQuery
      if (!callbackQuery || !('data' in callbackQuery)) {
        return
      }

      const identity = resolveIdentity(ctx)
      if (!identity) {
        return
      }

      await callbackController.handle({
        identity,
        messenger: new TelegrafBotMessenger(ctx),
        callbackData: callbackQuery.data
      })
    })
  })

  return bot
}

function resolveIdentity(ctx: Context): BotIdentity | null {
  const chatId = ctx.chat?.id
  const telegramUserId = ctx.from?.id
  if (chatId === undefined || telegramUserId === undefined) {
    return null
  }

  return { chatId, telegramUserId }
}

async function handleTelegramError(
  ctx: Context,
  logMessage: string,
  handler: () => Promise<void>
): Promise<void> {
  try {
    await handler()
  } catch (error) {
    const normalized = normalizeError(error)
    logger.error(
      {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details
      },
      logMessage
    )
    await ctx.reply(formatBotError(normalized), { parse_mode: 'HTML' })
  }
}
