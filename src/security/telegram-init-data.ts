import { createHmac, timingSafeEqual } from 'node:crypto'
import { appApiMessages } from '../i18n/index.js'
import { DEFAULT_LOCALE } from '../shared/i18n/index.js'

const TELEGRAM_WEB_APP_DATA_KEY = 'WebAppData'
const DEFAULT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

export type TelegramInitDataUser = {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
};

export type ValidateTelegramInitDataResult =
  | { ok: true; user: TelegramInitDataUser; authDate: Date }
  | { ok: false; message: string };

export function validateTelegramInitData(params: {
  initData: string;
  botToken: string;
  now?: Date;
  maxAgeSeconds?: number;
}): ValidateTelegramInitDataResult {
  const messages = appApiMessages(DEFAULT_LOCALE).initData

  if (!params.initData.trim()) {
    return { ok: false, message: messages.authRequired }
  }

  const searchParams = new URLSearchParams(params.initData)
  const receivedHash = searchParams.get('hash')
  if (!receivedHash) {
    return { ok: false, message: messages.missingHash }
  }

  searchParams.delete('hash')
  const dataCheckString = Array.from(searchParams.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHmac('sha256', TELEGRAM_WEB_APP_DATA_KEY).update(params.botToken).digest()
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (!isSafeEqualHex(receivedHash, expectedHash)) {
    return { ok: false, message: messages.invalidSignature }
  }

  const authDateSeconds = Number(searchParams.get('auth_date'))
  if (!Number.isInteger(authDateSeconds) || authDateSeconds <= 0) {
    return { ok: false, message: messages.invalidAuthDate }
  }

  const now = params.now ?? new Date()
  const maxAgeSeconds = params.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS
  if (authDateSeconds * 1000 < now.getTime() - maxAgeSeconds * 1000) {
    return { ok: false, message: messages.expired }
  }

  const userRaw = searchParams.get('user')
  if (!userRaw) {
    return { ok: false, message: messages.missingUser }
  }

  const user = parseTelegramUser(userRaw)
  if (!user) {
    return { ok: false, message: messages.invalidUser }
  }

  return { ok: true, user, authDate: new Date(authDateSeconds * 1000) }
}

function parseTelegramUser(value: string): TelegramInitDataUser | null {
  try {
    const parsed = JSON.parse(value) as unknown
    if (typeof parsed !== 'object' || parsed === null || !('id' in parsed)) {
      return null
    }

    const id = Number(parsed.id)
    if (!Number.isInteger(id) || id <= 0) {
      return null
    }

    return {
      id,
      firstName: readOptionalString(parsed, 'first_name'),
      lastName: readOptionalString(parsed, 'last_name'),
      username: readOptionalString(parsed, 'username'),
      languageCode: readOptionalString(parsed, 'language_code')
    }
  } catch {
    return null
  }
}

function readOptionalString(value: object, key: string): string | undefined {
  if (!(key in value)) {
    return undefined
  }

  const nextValue = value[key as keyof typeof value]
  return typeof nextValue === 'string' ? nextValue : undefined
}

function isSafeEqualHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
    return false
  }

  const leftBuffer = Buffer.from(left, 'hex')
  const rightBuffer = Buffer.from(right, 'hex')
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}
