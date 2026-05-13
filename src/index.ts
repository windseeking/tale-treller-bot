import { env } from './config/env.js'
import { createBotServices } from './config/bot-services.js'
import { createTrelloAuthServices } from './config/trello-auth-services.js'
import { normalizeError, toLogPayload } from './errors/error-handler.js'
import { createTelegramBot } from '@bot/telegram-bot.js'
import { TelegramBotNotifier } from '@bot/telegram-notifier.js'
import { DbClient } from './infrastructure/data-access/postgres/client.js'
import { runMigrations } from './infrastructure/data-access/postgres/migrations.js'
import { TrelloAuthSessionsRepository } from './infrastructure/data-access/postgres/repositories/trello-auth-sessions-repository.js'
import { TrelloConnectionsRepository } from './infrastructure/data-access/postgres/repositories/trello-connections-repository.js'
import { TelegramUsersRepository } from './infrastructure/data-access/postgres/repositories/telegram-users-repository.js'
import { UserSettingsRepository } from './infrastructure/data-access/postgres/repositories/user-settings-repository.js'
import { createHttpServer } from './infrastructure/http/express-server.js'
import { logger } from './infrastructure/logger/logger.js'

let shuttingDown = false
let stopBot: (() => Promise<void>) | null = null
let stopHttp: (() => Promise<void>) | null = null
let closeDb: (() => Promise<void>) | null = null

async function bootstrap(): Promise<void> {
  const db = new DbClient()
  closeDb = async () => {
    await db.close()
  }

  await runMigrations(db)

  const telegramUsersRepository = new TelegramUsersRepository(db)
  const trelloConnectionsRepository = new TrelloConnectionsRepository(db)
  const trelloAuthSessionsRepository = new TrelloAuthSessionsRepository(db)
  const userSettingsRepository = new UserSettingsRepository(db)
  const telegramNotifier = new TelegramBotNotifier()

  const trelloAuthServices = createTrelloAuthServices({
    tgUsersRepository: telegramUsersRepository,
    trelloConnectionsRepository,
    trelloAuthSessionsRepository,
    userSettingsRepository,
    tgNotifier: telegramNotifier
  })

  const httpServer = createHttpServer(trelloAuthServices, telegramUsersRepository, userSettingsRepository)
  await httpServer.start()
  stopHttp = async () => {
    await httpServer.stop()
  }

  const botServices = createBotServices({
    telegramUsersRepository,
    userSettingsRepository,
    trelloAuthServices
  })
  const bot = createTelegramBot({
    telegramToken: env.TELEGRAM_BOT_TOKEN,
    ...botServices
  })

  logger.info(
    {
      nodeEnv: env.NODE_ENV,
      appPort: env.APP_PORT
    },
    'Telegram Trello bot bootstrap initialized'
  )

  bot.catch((error: unknown) => {
    const normalized = normalizeError(error)
    logger.error(toLogPayload(normalized, { scope: 'telegram', action: 'middleware' }))
  })

  await bot.launch()
  stopBot = async () => {
    bot.stop('shutdown')
  }

  logger.info('Telegram bot and HTTP auth server started.')
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return
  }
  shuttingDown = true

  logger.warn({ signal }, 'Shutdown signal received')

  if (stopBot) {
    await stopBot()
  }

  if (stopHttp) {
    await stopHttp()
  }

  if (closeDb) {
    await closeDb()
  }

  logger.info('Application stopped')
  process.exit(0)
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})

process.on('unhandledRejection', (reason) => {
  const error = normalizeError(reason)
  logger.error(toLogPayload(error, { scope: 'process', action: 'unhandledRejection' }))
})

process.on('uncaughtException', (exception) => {
  const error = normalizeError(exception)
  logger.fatal(toLogPayload(error, { scope: 'process', action: 'uncaughtException' }))
  process.exit(1)
})

void bootstrap().catch((error) => {
  const normalized = normalizeError(error)
  logger.fatal(toLogPayload(normalized, { scope: 'bootstrap' }))
  process.exit(1)
})
