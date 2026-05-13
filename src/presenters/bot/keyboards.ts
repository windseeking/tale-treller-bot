import type { TrelloBoard } from '#interfaces/trello/boards/trello-board.js'
import type { TrelloList } from '#interfaces/trello/lists/trello-list.js'
import { BOT_BUTTON_LABELS } from '#interfaces/bot.js'
import { ValidationError } from '#errors/validation-error.js'

const CANCEL_BUTTON = [{ text: BOT_BUTTON_LABELS.inlineCancel, callback_data: 'task:cancel' }]
const CHANGE_BOARD_BUTTON = [{ text: BOT_BUTTON_LABELS.changeBoard, callback_data: 'trello:change_board' }]

export function boardsKeyboard(boards: TrelloBoard[]) {
  return {
    inline_keyboard: [
      ...boards.map((board) => [{ text: board.name, callback_data: `trello:board:${board.id}` }]),
      CANCEL_BUTTON
    ]
  }
}

export function listsKeyboard(lists: TrelloList[]) {
  return {
    inline_keyboard: [
      ...lists.map((list) => [{ text: list.name, callback_data: `trello:list:${list.id}` }]),
      CHANGE_BOARD_BUTTON,
      CANCEL_BUTTON
    ]
  }
}

export function cancelKeyboard() {
  return {
    inline_keyboard: [CANCEL_BUTTON]
  }
}

export function reuseSelectionKeyboard() {
  return {
    inline_keyboard: [
      [{ text: BOT_BUTTON_LABELS.useLastSelection, callback_data: 'trello:use_last_selection' }],
      CHANGE_BOARD_BUTTON,
      CANCEL_BUTTON
    ]
  }
}

export function cardCreatedKeyboard(cardUrl: string) {
  if (!isHttpUrl(cardUrl)) {
    throw new ValidationError({
      message: 'Cannot build card-created inline keyboard without a valid card URL',
      code: 'INVALID_CARD_URL',
      details: [
        {
          field: 'cardUrl',
          message: 'Expected an absolute http(s) URL for Telegram inline button url'
        }
      ]
    })
  }

  return {
    inline_keyboard: [[{ text: BOT_BUTTON_LABELS.openCard, url: cardUrl }]]
  }
}

export function trelloConnectKeyboard(url: string) {
  return {
    inline_keyboard: [[{ text: BOT_BUTTON_LABELS.connectTrello, url }]]
  }
}

export function unauthorizedReplyKeyboard() {
  return {
    keyboard: [[{ text: BOT_BUTTON_LABELS.connectTrello }]],
    resize_keyboard: true,
    one_time_keyboard: true
  }
}

export function authorizedReplyKeyboard() {
  return {
    keyboard: [
      [{ text: BOT_BUTTON_LABELS.createTask }, { text: BOT_BUTTON_LABELS.cancel }],
      [{ text: BOT_BUTTON_LABELS.disconnectTrello }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
