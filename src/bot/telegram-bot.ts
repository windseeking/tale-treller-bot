import { Telegraf, type Context } from 'telegraf'

import { TrelloAuthService } from '../auth/trello-auth-service.js'
import { env } from '../config/env.js'
import { TelegramUsersRepository } from '../db/repositories/telegram-users-repository.js'
import { UserSettingsRepository } from '../db/repositories/user-settings-repository.js'
import { AppError } from '../errors/app-error.js'
import { normalizeError } from '../errors/error-handler.js'
import { LlmClient } from '../llm/llm-client.js'
import { logger } from '../logger/logger.js'
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  resolveSupportedLocale,
  type SupportedLocale
} from '../shared/i18n/index.js'
import { getCurrentDateWithOffset } from '../settings/time-zone.js'
import type { TrelloAuthContext } from '../trello/types.js'
import { TrelloClient } from '../trello/trello-client.js'
import { resolveBotAction } from './actions.js'
import { validateTaskTextLength } from './card-content.js'
import {
  authorizedReplyKeyboard,
  boardsKeyboard,
  cancelKeyboard,
  cardCreatedKeyboard,
  listsKeyboard,
  reuseSelectionKeyboard,
  trelloConnectKeyboard,
  unauthorizedReplyKeyboard
} from './keyboards.js'
import { botMessages } from './messages.js'
import { SessionStore } from './session-store.js'

type Dependencies = {
  telegramToken: string;
  trelloClient: TrelloClient;
  llmClient: LlmClient;
  trelloAuthService: TrelloAuthService;
  telegramUsersRepository: TelegramUsersRepository;
  userSettingsRepository: UserSettingsRepository;
};

type BotSession = ReturnType<SessionStore['get']>;

type TelegramIdentity = {
  chatId: number;
  telegramUserId: number;
};

export function createTelegramBot({
  telegramToken,
  trelloClient,
  llmClient,
  trelloAuthService,
  telegramUsersRepository,
  userSettingsRepository
}: Dependencies): Telegraf {
  const bot = new Telegraf(telegramToken)
  const sessions = new SessionStore()

  bot.start(async (ctx: Context) => {
    const identity = resolveIdentity(ctx)
    if (!identity) {
      return
    }

    await ensureTelegramUser(telegramUsersRepository, identity)
    const locale = await ensureInitialLocale(userSettingsRepository, identity.telegramUserId, ctx.from?.language_code)
    const messages = botMessages(locale)
    sessions.resetTask(identity.chatId)

    const status = await trelloAuthService.getConnectionStatus(identity.telegramUserId)
    if (status.connected) {
      await replyMarkdown(ctx, messages.welcomeAuthorized, {
        reply_markup: authorizedReplyKeyboard(locale)
      })
      return
    }

    await replyMarkdown(ctx, messages.welcomeUnauthorized, {
      reply_markup: unauthorizedReplyKeyboard(locale)
    })
  })

  bot.command('cancel', async (ctx: Context) => {
    const identity = resolveIdentity(ctx)
    if (!identity) {
      return
    }

    const locale = await resolveUserLocale(userSettingsRepository, identity.telegramUserId)
    const messages = botMessages(locale)
    sessions.resetTask(identity.chatId)
    await replyMarkdown(ctx, messages.canceled, {
      reply_markup: await getMainReplyKeyboardForUser(trelloAuthService, identity, locale)
    })
  })

  bot.on('text', async (ctx: Context) => {
    const identity = resolveIdentity(ctx)
    const locale = identity
      ? await resolveUserLocale(userSettingsRepository, identity.telegramUserId)
      : DEFAULT_LOCALE
    const messages = botMessages(locale)

    try {
      if (!identity) {
        return
      }
      await ensureTelegramUser(telegramUsersRepository, identity)

      const message = ctx.message
      if (!message || !('text' in message)) {
        return
      }

      const text = message.text.trim()
      if (!text) {
        return
      }

      const action = resolveBotAction(text, locale)

      if (action === 'trello_connect') {
        await requestTrelloConnection({ ctx, trelloAuthService, identity, locale })
        return
      }

      if (action === 'trello_status') {
        await sendTrelloStatus({
          ctx,
          trelloAuthService,
          telegramUserId: identity.telegramUserId,
          locale
        })
        return
      }

      if (action === 'trello_disconnect') {
        await trelloAuthService.revokeConnection(identity.telegramUserId)
        await replyMarkdown(ctx, messages.authDisconnected, {
          reply_markup: unauthorizedReplyKeyboard(locale)
        })
        return
      }

      const session = sessions.get(identity.chatId)

      if (session.stage === 'selecting_board') {
        await replyMarkdown(ctx, messages.waitBoard)
        return
      }

      if (session.stage === 'selecting_list') {
        await replyMarkdown(ctx, messages.waitList)
        return
      }

      if (session.stage === 'confirming_last_selection') {
        await replyMarkdown(ctx, messages.waitLastSelection)
        return
      }

      if (action === 'cancel') {
        await tryDeleteIncomingMessage(ctx)
        sessions.resetTask(identity.chatId)
        await replyMarkdown(ctx, messages.canceled, {
          reply_markup: await getMainReplyKeyboardForUser(trelloAuthService, identity, locale)
        })
        return
      }

      if (action === 'create_task') {
        await tryDeleteIncomingMessage(ctx)
        await hideMainReplyKeyboard(ctx)
        const validation = validateTaskTextLength(session.messages)

        if (session.messages.length === 0) {
          await replyMarkdown(ctx, messages.draftEmpty, {
            reply_markup: await getMainReplyKeyboardForUser(trelloAuthService, identity, locale)
          })
          return
        }

        if (!validation.ok) {
          await replyMarkdown(ctx, messages.tooShort(validation.currentLength), {
            reply_markup: await getMainReplyKeyboardForUser(trelloAuthService, identity, locale)
          })
          return
        }

        const auth = await requireActiveAuth({
          ctx,
          session,
          trelloAuthService,
          identity,
          locale
        })
        if (!auth) {
          return
        }

        if (hasLastSelection(session)) {
          session.stage = 'confirming_last_selection'
          await replyMarkdown(
            ctx,
            messages.reuseSelection(
              escapeMarkdown(session.lastBoardName ?? ''),
              escapeMarkdown(session.lastListName ?? '')
            ),
            { reply_markup: reuseSelectionKeyboard(locale) }
          )
          return
        }

        await sendBoards(ctx, trelloClient, session, auth, locale)
        return
      }

      session.messages.push(text)
    } catch (error) {
      const normalized = normalizeError(error)
      logger.error(
        {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details
        },
        'Telegram text handling failed'
      )
      await ctx.reply(formatBotError(normalized, locale), { parse_mode: 'HTML' })
    }
  })

  bot.on('message', async (ctx: Context, next: () => Promise<void>) => {
    const message = ctx.message
    if (message && 'text' in message) {
      await next()
      return
    }

    const identity = resolveIdentity(ctx)
    const locale = identity
      ? await resolveUserLocale(userSettingsRepository, identity.telegramUserId)
      : DEFAULT_LOCALE
    await replyMarkdown(ctx, botMessages(locale).unsupportedMessage)
  })

  bot.on('callback_query', async (ctx: Context) => {
    const callbackQuery = ctx.callbackQuery
    if (!callbackQuery || !('data' in callbackQuery)) {
      return
    }

    const identity = resolveIdentity(ctx)
    if (!identity) {
      return
    }

    const locale = await resolveUserLocale(userSettingsRepository, identity.telegramUserId)
    const messages = botMessages(locale)
    const data = callbackQuery.data
    const session = sessions.get(identity.chatId)

    try {
      await ensureTelegramUser(telegramUsersRepository, identity)
      await safeAnswerCbQuery(ctx)

      if (data === 'action:cancel') {
        sessions.resetTask(identity.chatId)
        await replyMarkdown(ctx, messages.canceled, {
          reply_markup: await getMainReplyKeyboardForUser(trelloAuthService, identity, locale)
        })
        return
      }

      if (data === 'action:change_board') {
        const auth = await requireActiveAuth({ ctx, session, trelloAuthService, identity, locale })
        if (!auth) {
          return
        }

        session.stage = 'selecting_board'
        session.selectedBoardId = undefined
        session.selectedBoardName = undefined
        session.selectedListId = undefined
        session.selectedListName = undefined
        session.lists = []
        await sendBoards(ctx, trelloClient, session, auth, locale, {
          inCallbackMessage: true,
          text: messages.boardChanged
        })
        return
      }

      if (data === 'action:use_last_selection') {
        const auth = await requireActiveAuth({ ctx, session, trelloAuthService, identity, locale })
        if (!auth) {
          return
        }

        if (!hasLastSelection(session)) {
          session.stage = 'selecting_board'
          await sendBoards(ctx, trelloClient, session, auth, locale)
          return
        }

        session.selectedBoardId = session.lastBoardId
        session.selectedBoardName = session.lastBoardName
        session.selectedListId = session.lastListId
        session.selectedListName = session.lastListName

        await replaceCallbackMessageText(
          ctx,
          `${messages.boardSelected(escapeMarkdown(session.selectedBoardName ?? ''))}\n${messages.listSelected(
            escapeMarkdown(session.selectedListName ?? '')
          )}`
        )
        await createCardFromCurrentSelection({
          session,
          ctx,
          trelloClient,
          llmClient,
          auth,
          userSettingsRepository,
          telegramUserId: identity.telegramUserId,
          locale
        })
        return
      }

      if (data.startsWith('board:')) {
        const auth = await requireActiveAuth({ ctx, session, trelloAuthService, identity, locale })
        if (!auth) {
          return
        }

        const boardId = data.replace('board:', '')
        await onBoardSelected({ boardId, session, ctx, trelloClient, auth, locale })
        return
      }

      if (data.startsWith('list:')) {
        const auth = await requireActiveAuth({ ctx, session, trelloAuthService, identity, locale })
        if (!auth) {
          return
        }

        const listId = data.replace('list:', '')
        await onListSelected({
          listId,
          session,
          ctx,
          trelloClient,
          llmClient,
          auth,
          userSettingsRepository,
          telegramUserId: identity.telegramUserId,
          locale
        })
        return
      }
    } catch (error) {
      const normalized = normalizeError(error)
      logger.error(
        {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details
        },
        'Telegram callback handling failed'
      )
      await ctx.reply(formatBotError(normalized, locale), { parse_mode: 'HTML' })
    }
  })

  return bot
}

async function requestTrelloConnection(params: {
  ctx: Context;
  trelloAuthService: TrelloAuthService;
  identity: TelegramIdentity;
  locale: SupportedLocale;
}): Promise<void> {
  const link = await params.trelloAuthService.createAuthorizationLink({
    telegramUserId: params.identity.telegramUserId,
    telegramChatId: params.identity.chatId
  })
  const messages = botMessages(params.locale)
  await replyMarkdown(params.ctx, messages.authLinkCreated(formatDateTime(link.expiresAt, params.locale)), {
    reply_markup: trelloConnectKeyboard(link.url, params.locale)
  })
}

async function ensureTelegramUser(
  telegramUsersRepository: TelegramUsersRepository,
  identity: TelegramIdentity
): Promise<void> {
  await telegramUsersRepository.upsert({
    telegramUserId: identity.telegramUserId,
    telegramChatId: identity.chatId
  })
}

async function sendTrelloStatus(params: {
  ctx: Context;
  trelloAuthService: TrelloAuthService;
  telegramUserId: number;
  locale: SupportedLocale;
}): Promise<void> {
  const status = await params.trelloAuthService.getConnectionStatus(params.telegramUserId)
  const messages = botMessages(params.locale)
  if (!status.connected && !status.username) {
    await replyMarkdown(params.ctx, messages.authStatusNotConnected, {
      reply_markup: unauthorizedReplyKeyboard(params.locale)
    })
    return
  }

  const expires = status.expiresAt
    ? formatDateTime(status.expiresAt, params.locale)
    : messages.unknownDateTime
  const username = escapeMarkdown(status.username ?? 'unknown')

  if (status.expired) {
    await replyMarkdown(params.ctx, messages.authStatusExpired(username, expires), {
      reply_markup: unauthorizedReplyKeyboard(params.locale)
    })
    return
  }

  await replyMarkdown(params.ctx, messages.authStatusConnected(username, expires), {
    reply_markup: authorizedReplyKeyboard(params.locale)
  })
}

async function requireActiveAuth(params: {
  ctx: Context;
  session: BotSession;
  trelloAuthService: TrelloAuthService;
  identity: TelegramIdentity;
  locale: SupportedLocale;
}): Promise<TrelloAuthContext | null> {
  const auth = await params.trelloAuthService.getActiveAuthContext(params.identity.telegramUserId)
  if (auth) {
    return auth
  }

  clearSelectionFlow(params.session)
  const messages = botMessages(params.locale)
  await replyMarkdown(params.ctx, messages.authRequired, {
    reply_markup: unauthorizedReplyKeyboard(params.locale)
  })
  await requestTrelloConnection({
    ctx: params.ctx,
    trelloAuthService: params.trelloAuthService,
    identity: params.identity,
    locale: params.locale
  })
  return null
}

async function onBoardSelected(params: {
  boardId: string;
  session: BotSession;
  ctx: Context;
  trelloClient: TrelloClient;
  auth: TrelloAuthContext;
  locale: SupportedLocale;
}): Promise<void> {
  const { boardId, session, ctx, trelloClient, auth, locale } = params
  const messages = botMessages(locale)

  const selectedBoard = session.boards.find((board) => board.id === boardId)
  if (!selectedBoard) {
    await replyMarkdown(ctx, messages.pickBoard, { reply_markup: boardsKeyboard(session.boards, locale) })
    return
  }

  session.selectedBoardId = selectedBoard.id
  session.selectedBoardName = selectedBoard.name
  session.selectedListId = undefined
  session.selectedListName = undefined
  await replaceCallbackMessageText(ctx, messages.boardSelected(escapeMarkdown(selectedBoard.name)))

  const lists = await trelloClient.getBoardLists(selectedBoard.id, auth)

  if (lists.length === 0) {
    await replyMarkdown(ctx, messages.noLists)
    await sendBoards(ctx, trelloClient, session, auth, locale)
    return
  }

  session.stage = 'selecting_list'
  session.lists = lists

  await replyMarkdown(ctx, messages.pickList, { reply_markup: listsKeyboard(lists, locale) })
}

async function onListSelected(params: {
  listId: string;
  session: BotSession;
  ctx: Context;
  trelloClient: TrelloClient;
  llmClient: LlmClient;
  auth: TrelloAuthContext;
  userSettingsRepository: UserSettingsRepository;
  telegramUserId: number;
  locale: SupportedLocale;
}): Promise<void> {
  const { listId, session, ctx, trelloClient, llmClient, auth, userSettingsRepository, telegramUserId, locale } = params
  const messages = botMessages(locale)

  const selectedList = session.lists.find((list) => list.id === listId)
  if (!selectedList) {
    await replyMarkdown(ctx, messages.waitList, { reply_markup: listsKeyboard(session.lists, locale) })
    return
  }

  await replaceCallbackMessageText(ctx, messages.listSelected(escapeMarkdown(selectedList.name)))

  session.selectedListId = selectedList.id
  session.selectedListName = selectedList.name
  await createCardFromCurrentSelection({
    session,
    ctx,
    trelloClient,
    llmClient,
    auth,
    userSettingsRepository,
    telegramUserId,
    locale
  })
}

async function createCardFromCurrentSelection(params: {
  session: BotSession;
  ctx: Context;
  trelloClient: TrelloClient;
  llmClient: LlmClient;
  auth: TrelloAuthContext;
  userSettingsRepository: UserSettingsRepository;
  telegramUserId: number;
  locale: SupportedLocale;
}): Promise<void> {
  const { session, ctx, trelloClient, llmClient, auth, userSettingsRepository, telegramUserId, locale } = params
  const messages = botMessages(locale)

  if (!session.selectedListId || !session.selectedBoardId) {
    throw new AppError({
      message: 'Selected board/list is required to create card',
      code: 'SELECTION_REQUIRED'
    })
  }

  const progressMessage = await replyMarkdown(ctx, messages.cardInProgress)
  const resolvedTimeZone = await resolveUserTimeZone(userSettingsRepository, telegramUserId)

  const cardInput = await llmClient.generateCardInput({
    messages: session.messages,
    idList: session.selectedListId,
    currentDate: getCurrentDateWithOffset(resolvedTimeZone.timeZone)
  })
  cardInput.desc = appendBotSignature(cardInput.desc)

  const card = await trelloClient.createCard(cardInput, auth)

  await replaceBotMessageText(
    ctx,
    progressMessage.message_id,
    messages.cardCreated(escapeMarkdown(card.name), escapeMarkdown(card.shortUrl)),
    { reply_markup: cardCreatedKeyboard(card.shortUrl, locale) }
  )

  session.lastBoardId = session.selectedBoardId
  session.lastBoardName = session.selectedBoardName
  session.lastListId = session.selectedListId
  session.lastListName = session.selectedListName

  session.stage = 'collecting'
  session.messages = []
  session.boards = []
  session.lists = []
  session.selectedBoardId = undefined
  session.selectedBoardName = undefined
  session.selectedListId = undefined
  session.selectedListName = undefined
  await replyMarkdown(ctx, messages.readyForNextDraft, {
    reply_markup: authorizedReplyKeyboard(locale)
  })
}

async function resolveUserTimeZone(
  userSettingsRepository: UserSettingsRepository,
  telegramUserId: number
): Promise<{ timeZone: string; isDefault: boolean }> {
  const timeZone = await userSettingsRepository.findTimeZone(telegramUserId)
  if (timeZone) {
    return { timeZone, isDefault: false }
  }

  return { timeZone: env.APP_TIMEZONE, isDefault: true }
}

async function sendBoards(
  ctx: Context,
  trelloClient: TrelloClient,
  session: BotSession,
  auth: TrelloAuthContext,
  locale: SupportedLocale,
  options?: { inCallbackMessage?: boolean; text?: string }
): Promise<void> {
  const boards = await trelloClient.getMemberBoards(auth)
  const messages = botMessages(locale)
  session.boards = boards
  session.stage = 'selecting_board'
  const text = options?.text ?? messages.pickBoard

  if (boards.length === 0) {
    if (options?.inCallbackMessage) {
      await replaceCallbackMessageText(ctx, messages.noBoards, { reply_markup: cancelKeyboard(locale) })
      return
    }

    await replyMarkdown(ctx, messages.noBoards, { reply_markup: cancelKeyboard(locale) })
    return
  }

  if (options?.inCallbackMessage) {
    await replaceCallbackMessageText(ctx, text, { reply_markup: boardsKeyboard(boards, locale) })
    return
  }

  await replyMarkdown(ctx, text, { reply_markup: boardsKeyboard(boards, locale) })
}

async function getMainReplyKeyboardForUser(
  trelloAuthService: TrelloAuthService,
  identity: TelegramIdentity,
  locale: SupportedLocale
): Promise<ReturnType<typeof authorizedReplyKeyboard> | ReturnType<typeof unauthorizedReplyKeyboard>> {
  const status = await trelloAuthService.getConnectionStatus(identity.telegramUserId)
  return status.connected ? authorizedReplyKeyboard(locale) : unauthorizedReplyKeyboard(locale)
}

function hasLastSelection(session: BotSession): boolean {
  return Boolean(
    session.lastBoardId && session.lastBoardName && session.lastListId && session.lastListName
  )
}

function clearSelectionFlow(session: BotSession): void {
  session.stage = 'collecting'
  session.boards = []
  session.lists = []
  session.selectedBoardId = undefined
  session.selectedBoardName = undefined
  session.selectedListId = undefined
  session.selectedListName = undefined
}

function resolveIdentity(ctx: Context): TelegramIdentity | null {
  const chatId = ctx.chat?.id
  const telegramUserId = ctx.from?.id
  if (chatId === undefined || telegramUserId === undefined) {
    return null
  }

  return { chatId, telegramUserId }
}

async function resolveUserLocale(
  userSettingsRepository: UserSettingsRepository,
  telegramUserId: number
): Promise<SupportedLocale> {
  const locale = await userSettingsRepository.findLocale(telegramUserId)
  return isSupportedLocale(locale) ? locale : DEFAULT_LOCALE
}

async function ensureInitialLocale(
  userSettingsRepository: UserSettingsRepository,
  telegramUserId: number,
  languageCode?: string | null
): Promise<SupportedLocale> {
  const existingLocale = await userSettingsRepository.findLocale(telegramUserId)
  if (isSupportedLocale(existingLocale)) {
    return existingLocale
  }

  const locale = resolveSupportedLocale(languageCode)
  await userSettingsRepository.upsertLocale({ telegramUserId, locale })
  return locale
}

function formatBotError(error: AppError, locale: SupportedLocale): string {
  const debug = JSON.stringify(
    {
      code: error.code,
      message: error.message,
      details: error.details
    },
    null,
    2
  )

  return `${botMessages(locale).genericError}\n\n<pre>${escapeHtml(debug)}</pre>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeMarkdown(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('_', '\\_')
    .replaceAll('*', '\\*')
    .replaceAll('`', '\\`')
    .replaceAll('[', '\\[')
}

function formatDateTime(value: Date, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(value)
}

async function replyMarkdown(
  ctx: Context,
  text: string,
  extra?: Parameters<Context['reply']>[1]
): Promise<Awaited<ReturnType<Context['reply']>>> {
  return ctx.reply(text, { parse_mode: 'Markdown', ...extra })
}

async function safeAnswerCbQuery(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery()
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

async function replaceCallbackMessageText(
  ctx: Context,
  text: string,
  extra?: Parameters<Context['editMessageText']>[1]
): Promise<void> {
  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...extra })
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

    await replyMarkdown(ctx, text, extra)
  }
}

async function replaceBotMessageText(
  ctx: Context,
  messageId: number,
  text: string,
  extra?: {
    reply_markup?: ReturnType<typeof cardCreatedKeyboard>;
  }
): Promise<void> {
  const chatId = ctx.chat?.id
  if (chatId === undefined) {
    await replyMarkdown(ctx, text, extra)
    return
  }

  try {
    await ctx.telegram.editMessageText(chatId, messageId, undefined, text, {
      parse_mode: 'Markdown',
      ...extra
    })
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

    await replyMarkdown(ctx, text, extra)
  }
}

async function tryDeleteIncomingMessage(ctx: Context): Promise<void> {
  try {
    await ctx.deleteMessage()
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

async function hideMainReplyKeyboard(ctx: Context): Promise<void> {
  try {
    const chatId = ctx.chat?.id
    const markerMessage = await ctx.reply('\u2063', {
      reply_markup: { remove_keyboard: true }
    })

    if (chatId === undefined) {
      return
    }

    try {
      await ctx.telegram.deleteMessage(chatId, markerMessage.message_id)
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

function appendBotSignature(desc: string): string {
  const signature = 'Task created with [@taletrellerbot](https://t.me/taletrellerbot).'
  const trimmedDesc = desc.trimEnd()

  return `${trimmedDesc}\n\n${signature}`
}
