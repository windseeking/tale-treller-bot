import { Telegraf, type Context } from 'telegraf'

import { TrelloAuthService } from '../auth/trello-auth-service.js'
import { env } from '../config/env.js'
import { TelegramUsersRepository } from '../db/repositories/telegram-users-repository.js'
import { UserSettingsRepository } from '../db/repositories/user-settings-repository.js'
import { AppError } from '../errors/app-error.js'
import { normalizeError } from '../errors/error-handler.js'
import { LlmClient } from '../llm/llm-client.js'
import { logger } from '../logger/logger.js'
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
import { BOT_MESSAGES } from './messages.js'
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
    sessions.resetTask(identity.chatId)
    const status = await trelloAuthService.getConnectionStatus(identity.telegramUserId)
    if (status.connected) {
      await replyMarkdown(ctx, BOT_MESSAGES.welcomeAuthorized, {
        reply_markup: authorizedReplyKeyboardForIdentity()
      })
      return
    }
    await replyMarkdown(ctx, BOT_MESSAGES.welcomeUnauthorized, {
      reply_markup: unauthorizedReplyKeyboardForIdentity()
    })
  })

  bot.command('cancel', async (ctx: Context) => {
    const identity = resolveIdentity(ctx)
    if (!identity) {
      return
    }
    sessions.resetTask(identity.chatId)
    await replyMarkdown(ctx, BOT_MESSAGES.canceled, {
      reply_markup: await getMainReplyKeyboardForUser(trelloAuthService, identity)
    })
  })

  bot.on('text', async (ctx: Context) => {
    try {
      const identity = resolveIdentity(ctx)
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

      const action = resolveBotAction(text)

      if (action === 'trello_connect') {
        await requestTrelloConnection({ ctx, trelloAuthService, identity })
        return
      }

      if (action === 'trello_status') {
        await sendTrelloStatus({
          ctx,
          trelloAuthService,
          telegramUserId: identity.telegramUserId
        })
        return
      }

      if (action === 'trello_disconnect') {
        await trelloAuthService.revokeConnection(identity.telegramUserId)
        await replyMarkdown(ctx, BOT_MESSAGES.authDisconnected, {
          reply_markup: unauthorizedReplyKeyboardForIdentity()
        })
        return
      }

      const session = sessions.get(identity.chatId)

      if (session.stage === 'selecting_board') {
        await replyMarkdown(ctx, BOT_MESSAGES.waitBoard)
        return
      }

      if (session.stage === 'selecting_list') {
        await replyMarkdown(ctx, BOT_MESSAGES.waitList)
        return
      }

      if (session.stage === 'confirming_last_selection') {
        await replyMarkdown(ctx, BOT_MESSAGES.waitLastSelection)
        return
      }

      if (action === 'cancel') {
        await tryDeleteIncomingMessage(ctx)
        sessions.resetTask(identity.chatId)
        await replyMarkdown(ctx, BOT_MESSAGES.canceled, {
          reply_markup: await getMainReplyKeyboardForUser(trelloAuthService, identity)
        })
        return
      }

      if (action === 'create_task') {
        await tryDeleteIncomingMessage(ctx)
        await hideMainReplyKeyboard(ctx)
        const validation = validateTaskTextLength(session.messages)

        if (session.messages.length === 0) {
          await replyMarkdown(ctx, BOT_MESSAGES.draftEmpty, {
            reply_markup: await getMainReplyKeyboardForUser(trelloAuthService, identity)
          })
          return
        }

        if (!validation.ok) {
          await replyMarkdown(ctx, BOT_MESSAGES.tooShort(validation.currentLength), {
            reply_markup: await getMainReplyKeyboardForUser(trelloAuthService, identity)
          })
          return
        }

        const auth = await requireActiveAuth({
          ctx,
          session,
          trelloAuthService,
          identity
        })
        if (!auth) {
          return
        }

        if (hasLastSelection(session)) {
          session.stage = 'confirming_last_selection'
          await replyMarkdown(
            ctx,
            BOT_MESSAGES.reuseSelection(
              escapeMarkdown(session.lastBoardName ?? ''),
              escapeMarkdown(session.lastListName ?? '')
            ),
            { reply_markup: reuseSelectionKeyboard() }
          )
          return
        }

        await sendBoards(ctx, trelloClient, session, auth)
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
      await ctx.reply(formatBotError(normalized), { parse_mode: 'HTML' })
    }
  })

  bot.on('message', async (ctx: Context, next: () => Promise<void>) => {
    const message = ctx.message
    if (message && 'text' in message) {
      await next()
      return
    }
    await replyMarkdown(ctx, BOT_MESSAGES.unsupportedMessage)
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

    const data = callbackQuery.data
    const session = sessions.get(identity.chatId)

    try {
      await ensureTelegramUser(telegramUsersRepository, identity)
      await safeAnswerCbQuery(ctx)

      if (data === 'action:cancel') {
        sessions.resetTask(identity.chatId)
        await replyMarkdown(ctx, BOT_MESSAGES.canceled, {
          reply_markup: await getMainReplyKeyboardForUser(trelloAuthService, identity)
        })
        return
      }

      if (data === 'action:change_board') {
        const auth = await requireActiveAuth({ ctx, session, trelloAuthService, identity })
        if (!auth) {
          return
        }

        session.stage = 'selecting_board'
        session.selectedBoardId = undefined
        session.selectedBoardName = undefined
        session.selectedListId = undefined
        session.selectedListName = undefined
        session.lists = []
        await sendBoards(ctx, trelloClient, session, auth, {
          inCallbackMessage: true,
          text: BOT_MESSAGES.boardChanged
        })
        return
      }

      if (data === 'action:use_last_selection') {
        const auth = await requireActiveAuth({ ctx, session, trelloAuthService, identity })
        if (!auth) {
          return
        }

        if (!hasLastSelection(session)) {
          session.stage = 'selecting_board'
          await sendBoards(ctx, trelloClient, session, auth)
          return
        }

        session.selectedBoardId = session.lastBoardId
        session.selectedBoardName = session.lastBoardName
        session.selectedListId = session.lastListId
        session.selectedListName = session.lastListName

        await replaceCallbackMessageText(
          ctx,
          `${BOT_MESSAGES.boardSelected(escapeMarkdown(session.selectedBoardName ?? ''))}\n${BOT_MESSAGES.listSelected(
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
          telegramUserId: identity.telegramUserId
        })
        return
      }

      if (data.startsWith('board:')) {
        const auth = await requireActiveAuth({ ctx, session, trelloAuthService, identity })
        if (!auth) {
          return
        }

        const boardId = data.replace('board:', '')
        await onBoardSelected({ boardId, session, ctx, trelloClient, auth })
        return
      }

      if (data.startsWith('list:')) {
        const auth = await requireActiveAuth({ ctx, session, trelloAuthService, identity })
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
          telegramUserId: identity.telegramUserId
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
      await ctx.reply(formatBotError(normalized), { parse_mode: 'HTML' })
    }
  })

  return bot
}

async function requestTrelloConnection(params: {
  ctx: Context;
  trelloAuthService: TrelloAuthService;
  identity: TelegramIdentity;
}): Promise<void> {
  const link = await params.trelloAuthService.createAuthorizationLink({
    telegramUserId: params.identity.telegramUserId,
    telegramChatId: params.identity.chatId
  })
  await replyMarkdown(params.ctx, `${BOT_MESSAGES.authLinkCreated}\n\nСсылка действует до: *${formatDateTime(link.expiresAt)}*`, {
    reply_markup: trelloConnectKeyboard(link.url)
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
}): Promise<void> {
  const status = await params.trelloAuthService.getConnectionStatus(params.telegramUserId)
  if (!status.connected && !status.username) {
    await replyMarkdown(params.ctx, BOT_MESSAGES.authStatusNotConnected, {
      reply_markup: unauthorizedReplyKeyboardForIdentity()
    })
    return
  }

  const expires = status.expiresAt ? formatDateTime(status.expiresAt) : 'неизвестно'
  const username = escapeMarkdown(status.username ?? 'unknown')

  if (status.expired) {
    await replyMarkdown(params.ctx, BOT_MESSAGES.authStatusExpired(username, expires), {
      reply_markup: unauthorizedReplyKeyboardForIdentity()
    })
    return
  }

  await replyMarkdown(params.ctx, BOT_MESSAGES.authStatusConnected(username, expires), {
    reply_markup: authorizedReplyKeyboardForIdentity()
  })
}

async function requireActiveAuth(params: {
  ctx: Context;
  session: BotSession;
  trelloAuthService: TrelloAuthService;
  identity: TelegramIdentity;
}): Promise<TrelloAuthContext | null> {
  const auth = await params.trelloAuthService.getActiveAuthContext(params.identity.telegramUserId)
  if (auth) {
    return auth
  }

  clearSelectionFlow(params.session)
  await replyMarkdown(params.ctx, BOT_MESSAGES.authRequired, {
    reply_markup: unauthorizedReplyKeyboardForIdentity()
  })
  await requestTrelloConnection({
    ctx: params.ctx,
    trelloAuthService: params.trelloAuthService,
    identity: params.identity
  })
  return null
}

async function onBoardSelected(params: {
  boardId: string;
  session: BotSession;
  ctx: Context;
  trelloClient: TrelloClient;
  auth: TrelloAuthContext;
}): Promise<void> {
  const { boardId, session, ctx, trelloClient, auth } = params

  const selectedBoard = session.boards.find((board) => board.id === boardId)
  if (!selectedBoard) {
    await replyMarkdown(ctx, BOT_MESSAGES.pickBoard, { reply_markup: boardsKeyboard(session.boards) })
    return
  }

  session.selectedBoardId = selectedBoard.id
  session.selectedBoardName = selectedBoard.name
  session.selectedListId = undefined
  session.selectedListName = undefined
  await replaceCallbackMessageText(ctx, BOT_MESSAGES.boardSelected(escapeMarkdown(selectedBoard.name)))

  const lists = await trelloClient.getBoardLists(selectedBoard.id, auth)

  if (lists.length === 0) {
    await replyMarkdown(ctx, BOT_MESSAGES.noLists)
    await sendBoards(ctx, trelloClient, session, auth)
    return
  }

  session.stage = 'selecting_list'
  session.lists = lists

  await replyMarkdown(ctx, BOT_MESSAGES.pickList, { reply_markup: listsKeyboard(lists) })
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
}): Promise<void> {
  const { listId, session, ctx, trelloClient, llmClient, auth, userSettingsRepository, telegramUserId } = params

  const selectedList = session.lists.find((list) => list.id === listId)
  if (!selectedList) {
    await replyMarkdown(ctx, BOT_MESSAGES.waitList, { reply_markup: listsKeyboard(session.lists) })
    return
  }

  await replaceCallbackMessageText(ctx, BOT_MESSAGES.listSelected(escapeMarkdown(selectedList.name)))

  session.selectedListId = selectedList.id
  session.selectedListName = selectedList.name
  await createCardFromCurrentSelection({
    session,
    ctx,
    trelloClient,
    llmClient,
    auth,
    userSettingsRepository,
    telegramUserId
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
}): Promise<void> {
  const { session, ctx, trelloClient, llmClient, auth, userSettingsRepository, telegramUserId } = params

  if (!session.selectedListId || !session.selectedBoardId) {
    throw new AppError({
      message: 'Selected board/list is required to create card',
      code: 'SELECTION_REQUIRED'
    })
  }

  const progressMessage = await replyMarkdown(ctx, BOT_MESSAGES.cardInProgress)
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
    BOT_MESSAGES.cardCreated(escapeMarkdown(card.name), escapeMarkdown(card.shortUrl)),
    { reply_markup: cardCreatedKeyboard(card.shortUrl) }
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
  await replyMarkdown(ctx, BOT_MESSAGES.readyForNextDraft, {
    reply_markup: authorizedReplyKeyboardForIdentity()
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
  options?: { inCallbackMessage?: boolean; text?: string }
): Promise<void> {
  const boards = await trelloClient.getMemberBoards(auth)
  session.boards = boards
  session.stage = 'selecting_board'
  const text = options?.text ?? BOT_MESSAGES.pickBoard

  if (boards.length === 0) {
    if (options?.inCallbackMessage) {
      await replaceCallbackMessageText(ctx, BOT_MESSAGES.noBoards, { reply_markup: cancelKeyboard() })
      return
    }

    await replyMarkdown(ctx, BOT_MESSAGES.noBoards, { reply_markup: cancelKeyboard() })
    return
  }

  if (options?.inCallbackMessage) {
    await replaceCallbackMessageText(ctx, text, { reply_markup: boardsKeyboard(boards) })
    return
  }

  await replyMarkdown(ctx, text, { reply_markup: boardsKeyboard(boards) })
}

async function getMainReplyKeyboardForUser(
  trelloAuthService: TrelloAuthService,
  identity: TelegramIdentity
): Promise<ReturnType<typeof authorizedReplyKeyboard> | ReturnType<typeof unauthorizedReplyKeyboard>> {
  const status = await trelloAuthService.getConnectionStatus(identity.telegramUserId)
  return status.connected ? authorizedReplyKeyboardForIdentity() : unauthorizedReplyKeyboardForIdentity()
}

function authorizedReplyKeyboardForIdentity(): ReturnType<typeof authorizedReplyKeyboard> {
  return authorizedReplyKeyboard()
}

function unauthorizedReplyKeyboardForIdentity(): ReturnType<typeof unauthorizedReplyKeyboard> {
  return unauthorizedReplyKeyboard()
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

function formatBotError(error: AppError): string {
  const debug = JSON.stringify(
    {
      code: error.code,
      message: error.message,
      details: error.details
    },
    null,
    2
  )

  return `${BOT_MESSAGES.genericError}\n\n<pre>${escapeHtml(debug)}</pre>`
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

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
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
