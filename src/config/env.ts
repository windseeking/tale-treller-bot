import { config as loadEnv } from 'dotenv'
import { z } from 'zod'

import { isValidTimeZone } from '../settings/time-zone.js'

loadEnv()

function isValidBase64Key(value: string): boolean {
  try {
    const decoded = Buffer.from(value, 'base64')
    return decoded.length === 32
  } catch {
    return false
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  APP_TIMEZONE: z
    .string()
    .min(1, 'APP_TIMEZONE is required')
    .refine(isValidTimeZone, 'APP_TIMEZONE must be a valid IANA timezone'),
  APP_BASE_URL: z.url('APP_BASE_URL must be a valid URL'),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TRELLO_API_KEY: z.string().min(1, 'TRELLO_API_KEY is required'),
  TRELLO_API_SECRET: z.string().min(1, 'TRELLO_API_SECRET is required'),
  AUTH_ENCRYPTION_KEY: z
    .string()
    .min(1, 'AUTH_ENCRYPTION_KEY is required')
    .refine(isValidBase64Key, 'AUTH_ENCRYPTION_KEY must be base64 of 32-byte key'),
  AUTH_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  TRELLO_AUTH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  LLM_API_KEY: z.string().min(1, 'LLM_API_KEY is required'),
  LLM_MODEL: z.string().min(1, 'LLM_MODEL is required'),
  LLM_BASE_URL: z.url().optional()
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => issue.message).join('; ')
  throw new Error(`Invalid environment variables: ${issues}`)
}

export const env = parsed.data
