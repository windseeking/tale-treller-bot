import { config as loadEnv } from 'dotenv'

import { envValidator } from '#validators/config/env.js'

loadEnv()

const parsed = envValidator.validate(process.env)

if (parsed.errors.length > 0) {
  const issues = parsed.errors.map((issue) => issue.message).join('; ')
  throw new Error(`Invalid environment variables: ${issues}`)
}

export const env = parsed.data
