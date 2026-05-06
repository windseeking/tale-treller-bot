import type { TrelloBoard, TrelloList } from '../trello/types.js'
import { botButtons } from '../i18n/index.js'
import type { SupportedLocale } from '../shared/i18n/index.js'

function cancelButton(locale: SupportedLocale) {
  return [{ text: botButtons(locale).inlineCancel, callback_data: 'action:cancel' }]
}

function changeBoardButton(locale: SupportedLocale) {
  return [{ text: botButtons(locale).changeBoard, callback_data: 'action:change_board' }]
}

export function boardsKeyboard(boards: TrelloBoard[], locale: SupportedLocale) {
  return {
    inline_keyboard: [
      ...boards.map((board) => [{ text: board.name, callback_data: `board:${board.id}` }]),
      cancelButton(locale)
    ]
  }
}

export function listsKeyboard(lists: TrelloList[], locale: SupportedLocale) {
  return {
    inline_keyboard: [
      ...lists.map((list) => [{ text: list.name, callback_data: `list:${list.id}` }]),
      changeBoardButton(locale),
      cancelButton(locale)
    ]
  }
}

export function cancelKeyboard(locale: SupportedLocale) {
  return {
    inline_keyboard: [cancelButton(locale)]
  }
}

export function reuseSelectionKeyboard(locale: SupportedLocale) {
  return {
    inline_keyboard: [
      [{ text: botButtons(locale).useLastSelection, callback_data: 'action:use_last_selection' }],
      changeBoardButton(locale),
      cancelButton(locale)
    ]
  }
}

export function cardCreatedKeyboard(cardUrl: string, locale: SupportedLocale) {
  return {
    inline_keyboard: [[{ text: botButtons(locale).openCard, url: cardUrl }]]
  }
}

export function trelloConnectKeyboard(url: string, locale: SupportedLocale) {
  return {
    inline_keyboard: [[{ text: botButtons(locale).connectTrello, url }]]
  }
}

export function unauthorizedReplyKeyboard(locale: SupportedLocale) {
  return {
    keyboard: [[{ text: botButtons(locale).connectTrello }]],
    resize_keyboard: true,
    one_time_keyboard: true
  }
}

export function authorizedReplyKeyboard(locale: SupportedLocale) {
  const labels = botButtons(locale)

  return {
    keyboard: [
      [{ text: labels.createTask }, { text: labels.cancel }],
      [{ text: labels.disconnectTrello }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  }
}
