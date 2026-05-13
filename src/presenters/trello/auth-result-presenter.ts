import { env } from '#config/env.js'
import type { TrelloAuthResultCode } from '#interfaces/trello/auth/trello-auth-results.js'

const TRELLO_AUTH_RESULT_MESSAGES: Record<TrelloAuthResultCode, string> = {
  SESSION_NOT_FOUND: 'Сессия авторизации не найдена.',
  SESSION_ALREADY_USED: 'Ссылка уже использована. Вернитесь в Telegram и запустите подключение Trello ещё раз.',
  SESSION_EXPIRED: 'Сессия авторизации истекла. Запустите подключение снова.',
  SESSION_SECRET_INVALID: 'Неверный секрет сессии.',
  SESSION_STATUS_INVALID: 'Некорректный статус сессии. Запустите подключение заново.',
  USER_DENIED: 'Вы отменили подключение Trello.',
  MISSING_CALLBACK_PARAMS: 'Callback Trello не содержит обязательные параметры.',
  TOKEN_MISMATCH: 'Токен сессии не совпадает. Запустите подключение заново.',
  CONNECTED: 'Trello подключен. Можно возвращаться в Telegram.'
}

const TRELLO_AUTH_START_STATUS_CODES: Partial<Record<TrelloAuthResultCode, number>> = {
  SESSION_NOT_FOUND: 404,
  SESSION_ALREADY_USED: 409,
  SESSION_EXPIRED: 410,
  SESSION_SECRET_INVALID: 403
}

export function presentTrelloAuthMessage(code: TrelloAuthResultCode): string {
  return TRELLO_AUTH_RESULT_MESSAGES[code]
}

export function presentTrelloAuthStartStatusCode(code: TrelloAuthResultCode): number {
  return TRELLO_AUTH_START_STATUS_CODES[code] ?? 400
}

export function buildTrelloAuthResultUrl(status: 'success' | 'error', message: string): string {
  const url = new URL('/auth/trello/result', env.APP_BASE_URL)
  url.searchParams.set('status', status)
  url.searchParams.set('message', message)
  return url.toString()
}
