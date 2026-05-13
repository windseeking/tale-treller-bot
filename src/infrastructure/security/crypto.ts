import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import { env } from '../../config/env.js'
import { AppError } from '../../errors/app-error.js'

type EncryptedPayloadV1 = {
  v: 1;
  iv: string;
  tag: string;
  data: string;
};

const KEY = Buffer.from(env.AUTH_ENCRYPTION_KEY, 'base64')

export function encryptString(plainText: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  const payload: EncryptedPayloadV1 = {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64')
  }

  return JSON.stringify(payload)
}

export function decryptString(cipherText: string): string {
  const payload = parseEncryptedPayload(cipherText)

  const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(payload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final()
  ])

  return decrypted.toString('utf8')
}

export function generateOpaqueSecret(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('base64url')
}

export function isSecretHashMatch(params: { secret: string; hash: string }): boolean {
  const nextHash = hashSecret(params.secret)
  const left = Buffer.from(nextHash, 'utf8')
  const right = Buffer.from(params.hash, 'utf8')

  if (left.length !== right.length) {
    return false
  }

  return timingSafeEqual(left, right)
}

function parseEncryptedPayload(value: string): EncryptedPayloadV1 {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new AppError({
      message: 'Encrypted payload parse failed',
      code: 'ENCRYPTED_PAYLOAD_INVALID'
    })
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('v' in parsed) ||
    !('iv' in parsed) ||
    !('tag' in parsed) ||
    !('data' in parsed)
  ) {
    throw new AppError({
      message: 'Encrypted payload has invalid shape',
      code: 'ENCRYPTED_PAYLOAD_INVALID'
    })
  }

  const payload = parsed as EncryptedPayloadV1
  if (payload.v !== 1) {
    throw new AppError({
      message: 'Encrypted payload version is not supported',
      code: 'ENCRYPTED_PAYLOAD_UNSUPPORTED'
    })
  }

  return payload
}
