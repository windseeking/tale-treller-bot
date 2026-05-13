import type { AppError } from '#errors/app-error.js'
import { BOT_MESSAGES } from './messages.js'

export function formatBotError(error: AppError): string {
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
  if (!value) return ''
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}
