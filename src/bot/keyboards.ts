import type { TrelloBoard, TrelloList } from '../trello/types.js'
import { BOT_BUTTON_LABELS } from './actions.js'

const CANCEL_BUTTON = [{ text: BOT_BUTTON_LABELS.inlineCancel, callback_data: 'action:cancel' }]
const CHANGE_BOARD_BUTTON = [{ text: BOT_BUTTON_LABELS.changeBoard, callback_data: 'action:change_board' }]

export function boardsKeyboard(boards: TrelloBoard[]) {
  return {
    inline_keyboard: [
      ...boards.map((board) => [{ text: board.name, callback_data: `board:${board.id}` }]),
      CANCEL_BUTTON
    ]
  }
}

export function listsKeyboard(lists: TrelloList[]) {
  return {
    inline_keyboard: [
      ...lists.map((list) => [{ text: list.name, callback_data: `list:${list.id}` }]),
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
      [{ text: BOT_BUTTON_LABELS.useLastSelection, callback_data: 'action:use_last_selection' }],
      CHANGE_BOARD_BUTTON,
      CANCEL_BUTTON
    ]
  }
}

export function cardCreatedKeyboard(cardUrl: string) {
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
