import { env } from '#config/env.js'
import type { BotAction, BotRequest, BotSessionState, SessionStorePort, TaskDestinationHandler, BotWelcomeResponse } from '#interfaces/bot.js'
import type { UserSettingsRepositoryPort } from '#interfaces/settings/user-settings-repository.js'
import { USER_SETTING_KEYS } from '#interfaces/settings/user-setting-keys.js'
import type { TrelloAuthContext } from '#interfaces/trello/auth/trello-auth-context.js'
import type { TrelloBoard } from '#interfaces/trello/boards/trello-board.js'
import type { TrelloList } from '#interfaces/trello/lists/trello-list.js'
import type { ListBoardLists } from '#usecases/trello/list-board-lists.js'
import type { ListTrelloBoards } from '#usecases/trello/list-trello-boards.js'
import type { CreateTrelloTask } from '#usecases/trello/create-trello-task.js'
import type { DisconnectTrelloAccount } from '#usecases/trello/auth/disconnect-trello-account.js'
import type { GetTrelloConnectionStatus } from '#usecases/trello/auth/get-trello-connection-status.js'
import type { InitiateTrelloConnection } from '#usecases/trello/auth/initiate-trello-connection.js'
import type { TrelloAuthContextProvider } from '#interfaces/trello/auth/trello-auth-context.js'
import {
  authorizedReplyKeyboard,
  boardsKeyboard,
  cancelKeyboard,
  cardCreatedKeyboard,
  listsKeyboard,
  reuseSelectionKeyboard,
  trelloConnectKeyboard,
  unauthorizedReplyKeyboard
} from '../../../presenters/bot/keyboards.js'
import { BOT_MESSAGES } from '../../../presenters/bot/messages.js'
import type { TimeZoneProvider } from '#interfaces/settings/time-zone-provider.js'
import escapeMarkdown from '#utils/escapeMarkdown.js'
import formatDateTime from '#utils/formatDateTime.js'

const TRELLO_DESTINATION_ID = 'trello'
const SELECTING_LAST = 'trello:last_selection'
const SELECTING_BOARD = 'trello:board'
const SELECTING_LIST = 'trello:list'

type TrelloDestinationState = {
  boards?: TrelloBoard[];
  lists?: TrelloList[];
  selectedBoardId?: string;
  selectedBoardName?: string;
  selectedListId?: string;
  selectedListName?: string;
};

export class TrelloDestinationHandler implements TaskDestinationHandler {
  public readonly id = TRELLO_DESTINATION_ID

  public constructor(
    private readonly sessions: SessionStorePort,
    private readonly initiateTrelloConnection: InitiateTrelloConnection,
    private readonly getTrelloConnectionStatus: GetTrelloConnectionStatus,
    private readonly authContextProvider: TrelloAuthContextProvider,
    private readonly disconnectTrelloAccount: DisconnectTrelloAccount,
    private readonly listBoards: ListTrelloBoards,
    private readonly listBoardLists: ListBoardLists,
    private readonly createTrelloTask: CreateTrelloTask,
    private readonly userSettingsRepository: UserSettingsRepositoryPort,
    private readonly timeZoneProvider: TimeZoneProvider
  ) {}

  public ownsAction(action: BotAction): boolean {
    return action === 'trello:connect' || action === 'trello:status' || action === 'trello:disconnect'
  }

  public ownsCallbackData(data: string): boolean {
    return data.startsWith('trello:')
  }

  public async getWelcomeResponse(context: { identity: BotRequest['identity'] }): Promise<BotWelcomeResponse> {
    const status = await this.getTrelloConnectionStatus.call(context.identity.telegramUserId)
    if (status.connected) {
      return {
        text: BOT_MESSAGES.welcomeAuthorized,
        replyMarkup: authorizedReplyKeyboard()
      }
    }

    return {
      text: BOT_MESSAGES.welcomeUnauthorized,
      replyMarkup: unauthorizedReplyKeyboard()
    }
  }

  public async getMainReplyKeyboard(context: { identity: BotRequest['identity'] }): Promise<unknown> {
    const status = await this.getTrelloConnectionStatus.call(context.identity.telegramUserId)
    return status.connected ? authorizedReplyKeyboard() : unauthorizedReplyKeyboard()
  }

  public async handleAction(request: BotRequest, _session: BotSessionState): Promise<void> {
    if (request.action === 'trello:connect') {
      await this.requestTrelloConnection(request)
      return
    }

    if (request.action === 'trello:status') {
      await this.sendTrelloStatus(request)
      return
    }

    if (request.action === 'trello:disconnect') {
      await this.disconnectTrelloAccount.call(request.identity.telegramUserId)
      await request.messenger.replyMarkdown(BOT_MESSAGES.authDisconnected, {
        reply_markup: unauthorizedReplyKeyboard()
      })
    }
  }

  public async handleCallback(request: BotRequest, session: BotSessionState): Promise<void> {
    const data = request.callbackData
    if (!data) {
      return
    }

    const auth = await this.requireActiveAuth(request, session)
    if (!auth) {
      return
    }

    if (data === 'trello:change_board') {
      this.sessions.startDestinationFlow(session, {
        destinationId: this.id,
        selectionStep: SELECTING_BOARD,
        state: {}
      })
      await this.sendBoards({ request, session, auth, inCallbackMessage: true, text: BOT_MESSAGES.boardChanged })
      return
    }

    if (data === 'trello:use_last_selection') {
      if (!session.lastTarget) {
        this.sessions.setSelectionStep(session, SELECTING_BOARD)
        await this.sendBoards({ request, session, auth })
        return
      }

      this.sessions.useLastSelection(session)
      const target = getTrelloTarget(session)
      await request.messenger.replaceCallbackMessageText(
        `${BOT_MESSAGES.boardSelected(escapeMarkdown(target.boardName))}\n${BOT_MESSAGES.listSelected(
          escapeMarkdown(target.listName)
        )}`
      )
      await this.createCardFromCurrentSelection({ request, session })
      return
    }

    if (data.startsWith('trello:board:')) {
      await this.onBoardSelected({
        boardId: data.replace('trello:board:', ''),
        request,
        session,
        auth
      })
      return
    }

    if (data.startsWith('trello:list:')) {
      await this.onListSelected({
        listId: data.replace('trello:list:', ''),
        request,
        session
      })
    }
  }

  public async handleTextDuringFlow(request: BotRequest, session: BotSessionState): Promise<void> {
    if (session.selectionStep === SELECTING_BOARD) {
      await request.messenger.replyMarkdown(BOT_MESSAGES.waitBoard)
      return
    }

    if (session.selectionStep === SELECTING_LIST) {
      await request.messenger.replyMarkdown(BOT_MESSAGES.waitList)
      return
    }

    if (session.selectionStep === SELECTING_LAST) {
      await request.messenger.replyMarkdown(BOT_MESSAGES.waitLastSelection)
    }
  }

  public async beginTaskCreation(request: BotRequest, session: BotSessionState): Promise<void> {
    const auth = await this.requireActiveAuth(request, session)
    if (!auth) {
      return
    }

    if (session.lastTarget) {
      this.sessions.startDestinationFlow(session, {
        destinationId: this.id,
        selectionStep: SELECTING_LAST,
        state: {}
      })
      const target = getTrelloTarget({ selectedTarget: session.lastTarget } as BotSessionState)
      await request.messenger.replyMarkdown(
        BOT_MESSAGES.reuseSelection(escapeMarkdown(target.boardName), escapeMarkdown(target.listName)),
        { reply_markup: reuseSelectionKeyboard() }
      )
      return
    }

    this.sessions.startDestinationFlow(session, {
      destinationId: this.id,
      selectionStep: SELECTING_BOARD,
      state: {}
    })
    await this.sendBoards({ request, session, auth })
  }

  private async requestTrelloConnection(request: BotRequest): Promise<void> {
    const link = await this.initiateTrelloConnection.call({
      telegramUserId: request.identity.telegramUserId,
      telegramChatId: request.identity.chatId
    })

    await request.messenger.replyMarkdown(
      `${BOT_MESSAGES.authLinkCreated}\n\nСсылка действует до: *${formatDateTime(link.expiresAt)}*`,
      {
        reply_markup: trelloConnectKeyboard(link.url)
      }
    )
  }

  private async sendTrelloStatus(request: BotRequest): Promise<void> {
    const status = await this.getTrelloConnectionStatus.call(request.identity.telegramUserId)
    if (!status.connected && !status.username) {
      await request.messenger.replyMarkdown(BOT_MESSAGES.authStatusNotConnected, {
        reply_markup: unauthorizedReplyKeyboard()
      })
      return
    }

    const expires = status.expiresAt ? formatDateTime(status.expiresAt) : 'неизвестно'
    const username = escapeMarkdown(status.username ?? 'unknown')

    if (status.expired) {
      await request.messenger.replyMarkdown(BOT_MESSAGES.authStatusExpired(username, expires), {
        reply_markup: unauthorizedReplyKeyboard()
      })
      return
    }

    await request.messenger.replyMarkdown(BOT_MESSAGES.authStatusConnected(username, expires), {
      reply_markup: authorizedReplyKeyboard()
    })
  }

  private async requireActiveAuth(
    request: BotRequest,
    session: BotSessionState
  ): Promise<TrelloAuthContext | null> {
    const auth = await this.authContextProvider.getActiveAuthContext(request.identity.telegramUserId)
    if (auth) {
      return auth
    }

    this.sessions.clearSelectionFlow(session)
    await request.messenger.replyMarkdown(BOT_MESSAGES.authRequired, {
      reply_markup: unauthorizedReplyKeyboard()
    })
    await this.requestTrelloConnection(request)
    return null
  }

  private async sendBoards(params: {
    request: BotRequest;
    session: BotSessionState;
    auth: TrelloAuthContext;
    inCallbackMessage?: boolean;
    text?: string;
  }): Promise<void> {
    const boards = await this.listBoards.call({ auth: params.auth })
    const state = getTrelloState(params.session)
    state.boards = boards
    state.lists = []
    params.session.destinationState = state
    this.sessions.setSelectionStep(params.session, SELECTING_BOARD)
    const text = params.text ?? BOT_MESSAGES.pickBoard

    if (boards.length === 0) {
      if (params.inCallbackMessage) {
        await params.request.messenger.replaceCallbackMessageText(BOT_MESSAGES.noBoards, {
          reply_markup: cancelKeyboard()
        })
        return
      }

      await params.request.messenger.replyMarkdown(BOT_MESSAGES.noBoards, { reply_markup: cancelKeyboard() })
      return
    }

    if (params.inCallbackMessage) {
      await params.request.messenger.replaceCallbackMessageText(text, { reply_markup: boardsKeyboard(boards) })
      return
    }

    await params.request.messenger.replyMarkdown(text, { reply_markup: boardsKeyboard(boards) })
  }

  private async onBoardSelected(params: {
    boardId: string;
    request: BotRequest;
    session: BotSessionState;
    auth: TrelloAuthContext;
  }): Promise<void> {
    const state = getTrelloState(params.session)
    const selectedBoard = state.boards?.find((board) => board.id === params.boardId)
    if (!selectedBoard) {
      await params.request.messenger.replyMarkdown(BOT_MESSAGES.pickBoard, {
        reply_markup: boardsKeyboard(state.boards ?? [])
      })
      return
    }

    state.selectedBoardId = selectedBoard.id
    state.selectedBoardName = selectedBoard.name
    state.selectedListId = undefined
    state.selectedListName = undefined
    await params.request.messenger.replaceCallbackMessageText(
      BOT_MESSAGES.boardSelected(escapeMarkdown(selectedBoard.name))
    )

    const lists = await this.listBoardLists.call({
      boardId: selectedBoard.id,
      auth: params.auth
    })

    if (lists.length === 0) {
      await params.request.messenger.replyMarkdown(BOT_MESSAGES.noLists)
      await this.sendBoards({
        request: params.request,
        session: params.session,
        auth: params.auth
      })
      return
    }

    state.lists = lists
    params.session.destinationState = state
    this.sessions.setSelectionStep(params.session, SELECTING_LIST)

    await params.request.messenger.replyMarkdown(BOT_MESSAGES.pickList, { reply_markup: listsKeyboard(lists) })
  }

  private async onListSelected(params: {
    listId: string;
    request: BotRequest;
    session: BotSessionState;
  }): Promise<void> {
    const state = getTrelloState(params.session)
    const selectedList = state.lists?.find((list) => list.id === params.listId)
    if (!selectedList) {
      await params.request.messenger.replyMarkdown(BOT_MESSAGES.waitList, {
        reply_markup: listsKeyboard(state.lists ?? [])
      })
      return
    }

    await params.request.messenger.replaceCallbackMessageText(
      BOT_MESSAGES.listSelected(escapeMarkdown(selectedList.name))
    )

    state.selectedListId = selectedList.id
    state.selectedListName = selectedList.name
    params.session.destinationState = state
    this.sessions.setSelectedTarget(params.session, {
      id: selectedList.id,
      name: selectedList.name,
      data: {
        destinationId: this.id,
        boardId: state.selectedBoardId,
        boardName: state.selectedBoardName,
        listId: selectedList.id,
        listName: selectedList.name
      }
    })

    await this.createCardFromCurrentSelection({
      request: params.request,
      session: params.session
    })
  }

  private async createCardFromCurrentSelection(params: {
    request: BotRequest;
    session: BotSessionState;
  }): Promise<void> {
    const progressMessage = await params.request.messenger.replyMarkdown(BOT_MESSAGES.cardInProgress)

    if (!params.session.draftText || !params.session.selectedTarget) {
      throw new Error('Cannot create Trello card without draft text and selected Trello target')
    }

    const target = getTrelloTarget(params.session)
    const timeZone =
      await this.userSettingsRepository.findValue(params.request.identity.telegramUserId, USER_SETTING_KEYS.TIME_ZONE) ?? env.APP_TIMEZONE

    const card = await this.createTrelloTask.call({
      telegramUserId: params.request.identity.telegramUserId,
      text: params.session.draftText,
      boardId: target.boardId,
      listId: target.listId,
      currentDate: this.timeZoneProvider.getCurrentDateWithOffset(timeZone)
    })

    const cardUrl = card.shortUrl ?? card.url
    const messageOptions = isHttpUrl(cardUrl) ? { reply_markup: cardCreatedKeyboard(cardUrl) } : undefined

    await params.request.messenger.replaceBotMessageText(
      progressMessage.messageId,
      BOT_MESSAGES.cardCreated(escapeMarkdown(card.name), escapeMarkdown(cardUrl)),
      messageOptions
    )

    this.sessions.completeTaskAndRememberSelection(params.session)

    await params.request.messenger.replyMarkdown(BOT_MESSAGES.readyForNextDraft, {
      reply_markup: authorizedReplyKeyboard()
    })
  }
}

function getTrelloState(session: BotSessionState): TrelloDestinationState {
  return session.destinationState as TrelloDestinationState
}

function getTrelloTarget(session: Pick<BotSessionState, 'selectedTarget'>): {
  boardId: string;
  boardName: string;
  listId: string;
  listName: string;
} {
  const data = session.selectedTarget?.data
  if (!data) {
    throw new Error('Selected Trello target is missing target data')
  }

  const boardId = data.boardId
  const boardName = data.boardName
  const listId = data.listId
  const listName = data.listName

  if (
    typeof boardId !== 'string' ||
    typeof boardName !== 'string' ||
    typeof listId !== 'string' ||
    typeof listName !== 'string'
  ) {
    throw new Error('Selected Trello target data is invalid')
  }

  return { boardId, boardName, listId, listName }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
