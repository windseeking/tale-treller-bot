import http from 'node:http'
import path from 'node:path'

import express, { type Express, type Request, type Response } from 'express'
import type { ViteDevServer } from 'vite'

import { SettingsController, type AppApiContext } from '../../controllers/app-api/settings-controller.js'
import { TrelloController } from '../../controllers/app-api/trello-controller.js'
import { TrelloAuthController } from '../../controllers/trello/auth-controller.js'
import { renderHtml } from '../../presenters/http/html-page.js'
import { buildTrelloAuthResultUrl } from '../../presenters/trello/auth-result-presenter.js'
import { normalizeError, toLogPayload } from '../../errors/error-handler.js'
import { env } from '../../config/env.js'
import type { TrelloAuthServices } from '../../config/trello-auth-services.js'
import { logger } from '../logger/logger.js'
import { TelegramUsersRepository } from '../data-access/postgres/repositories/telegram-users-repository.js'
import { UserSettingsRepository } from '../data-access/postgres/repositories/user-settings-repository.js'
import { validateTelegramInitData } from '../security/telegram-init-data.js'
import { timeZoneProvider } from '../settings/time-zone.js'

const APP_STATIC_DIR = path.resolve('dist/public/app')
const TELEGRAM_INIT_DATA_HEADER = 'x-telegram-init-data'

export function createHttpServer(
  trelloAuthServices: TrelloAuthServices,
  telegramUsersRepository: TelegramUsersRepository,
  userSettingsRepository: UserSettingsRepository
): {
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const app = express()
  const trelloController = new TrelloController(
    trelloAuthServices.getStatus,
    trelloAuthServices.initConnection,
    trelloAuthServices.disconnectAccount
  )
  const settingsController = new SettingsController(userSettingsRepository, timeZoneProvider, trelloController)
  const trelloAuthController = new TrelloAuthController(
    trelloAuthServices.startOAuthRedirect,
    trelloAuthServices.connectAccount
  )
  let server: http.Server | null = null
  let viteServer: ViteDevServer | null = null
  let frontendConfigured = false

  app.use(express.json({ limit: '16kb' }))

  app.get('/api/app/time-zones', async (_req, res) => {
    res.status(200).json({ ok: true, timeZones: settingsController.listTimeZones() })
  })

  app.get('/api/app/me', async (req, res) => {
    await withAppInitData(req, res, telegramUsersRepository, async (appContext) => {
      res.status(200).json({
        ok: true,
        ...(await settingsController.getAppPayload(appContext))
      })
    })
  })

  app.patch('/api/app/settings', async (req, res) => {
    await withAppInitData(req, res, telegramUsersRepository, async (appContext) => {
      const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
      const timeZone = 'timeZone' in body && typeof body.timeZone === 'string' ? body.timeZone : ''

      if (!timeZoneProvider.isValidTimeZone(timeZone)) {
        res.status(400).json({ ok: false, message: 'Некорректный часовой пояс.' })
        return
      }

      res.status(200).json({
        ok: true,
        settings: await settingsController.saveTimeZone({
          telegramUserId: appContext.telegramUserId,
          timeZone
        })
      })
    })
  })

  app.get('/api/app/trello/status', async (req, res) => {
    await withAppInitData(req, res, telegramUsersRepository, async (appContext) => {
      res.status(200).json({
        ok: true,
        trello: await trelloController.getStatus(appContext.telegramUserId)
      })
    })
  })

  app.post('/api/app/trello/connect-link', async (req, res) => {
    await withAppInitData(req, res, telegramUsersRepository, async (appContext) => {
      const link = await trelloController.createConnectLink({
        telegramUserId: appContext.telegramUserId,
        telegramChatId: appContext.telegramChatId
      })
      res.status(200).json({ ok: true, url: link.url, expiresAt: link.expiresAt })
    })
  })

  app.post('/api/app/trello/disconnect', async (req, res) => {
    await withAppInitData(req, res, telegramUsersRepository, async (appContext) => {
      res.status(200).json({
        ok: true,
        trello: await trelloController.disconnect(appContext.telegramUserId)
      })
    })
  })

  app.get('/auth/trello/start', async (req, res) => {
    const sid = typeof req.query.sid === 'string' ? req.query.sid : ''
    const secret = typeof req.query.secret === 'string' ? req.query.secret : ''

    if (!sid || !secret) {
      res.status(400).send(renderHtml('Ошибка', 'Некорректная ссылка авторизации.'))
      return
    }

    try {
      const result = await trelloAuthController.start({ sid, secret })
      if (!result.ok) {
        res.status(result.statusCode).send(renderHtml('Ошибка авторизации', result.reason))
        return
      }

      res.redirect(302, result.redirectUrl)
    } catch (error) {
      const normalized = normalizeError(error)
      logger.error(toLogPayload(normalized, { scope: 'http', action: 'authStart' }))
      res
        .status(500)
        .send(renderHtml('Ошибка', 'Не удалось запустить авторизацию Trello. Попробуйте снова из Telegram.'))
    }
  })

  app.get('/auth/trello/callback', async (req, res) => {
    const sid = typeof req.query.sid === 'string' ? req.query.sid : ''
    const oauthToken = typeof req.query.oauth_token === 'string' ? req.query.oauth_token : undefined
    const oauthVerifier =
      typeof req.query.oauth_verifier === 'string' ? req.query.oauth_verifier : undefined
    const denied = typeof req.query.denied === 'string' ? req.query.denied : undefined

    if (!sid) {
      res.status(400).send(renderHtml('Ошибка', 'Отсутствует идентификатор сессии.'))
      return
    }

    try {
      const result = await trelloAuthController.complete({ sid, oauthToken, oauthVerifier, denied })
      if (!result.ok) {
        res.status(400).send(renderHtml('Подключение не завершено', result.reason))
        return
      }

      res.redirect(302, result.resultUrl)
    } catch (error) {
      const normalized = normalizeError(error)
      logger.error(toLogPayload(normalized, { scope: 'http', action: 'authCallback' }))
      res.redirect(302, buildTrelloAuthResultUrl('error', 'Не удалось завершить подключение Trello.'))
    }
  })

  app.get('/auth/trello/result', (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : 'error'
    const message =
      typeof req.query.message === 'string'
        ? req.query.message
        : 'Произошла ошибка. Вернитесь в Telegram и повторите попытку.'

    const title = status === 'success' ? 'Вы авторизованы в Trello' : 'Подключение Trello'
    res.status(status === 'success' ? 200 : 400).send(renderHtml(title, message))
  })

  return {
    start: async () => {
      if (!frontendConfigured) {
        server = http.createServer(app)
        viteServer = await configureAppFrontend(app, server)
        frontendConfigured = true
      }

      await new Promise<void>((resolve, reject) => {
        const instance = server ?? http.createServer(app)
        instance.listen(env.APP_PORT, () => {
          server = instance
          resolve()
        })

        instance.on('error', (error) => {
          reject(error)
        })
      })
    },
    stop: async () => {
      if (!server) {
        return
      }

      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
      server = null
      await viteServer?.close()
      viteServer = null
    }
  }
}

async function configureAppFrontend(app: Express, httpServer: http.Server): Promise<ViteDevServer | null> {
  if (env.NODE_ENV === 'development') {
    try {
      const { createServer: createViteServer } = await import('vite')
      const viteServer = await createViteServer({
        configFile: path.resolve('app/vite.config.ts'),
        server: {
          middlewareMode: true,
          hmr: {
            server: httpServer
          }
        }
      })

      app.use(viteServer.middlewares)
      logger.info({ scope: 'http', action: 'appDevServer' }, 'Serving Telegram App through Vite middleware')
      return viteServer
    } catch (error) {
      if (!isMissingViteError(error)) {
        throw error
      }

      logger.warn(
        { scope: 'http', action: 'appDevServer' },
        'Vite is not available; serving built Telegram App assets'
      )
    }
  }

  app.use('/app/assets', express.static(path.join(APP_STATIC_DIR, 'assets')))

  app.get('/app', (_req, res) => {
    res.sendFile(path.join(APP_STATIC_DIR, 'index.html'), (error) => {
      if (!error) {
        return
      }

      res
        .status(503)
        .send(renderHtml('Приложение недоступно', 'App еще не собран. Запустите npm run build.'))
    })
  })

  return null
}

function isMissingViteError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND'
}

async function withAppInitData(
  req: Request,
  res: Response,
  telegramUsersRepository: TelegramUsersRepository,
  handler: (appContext: AppApiContext) => Promise<void>
): Promise<void> {
  const initData = req.header(TELEGRAM_INIT_DATA_HEADER)
  if (!initData) {
    res.status(401).json({ ok: false, message: 'Откройте приложение из Telegram.' })
    return
  }

  try {
    const validation = validateTelegramInitData({ initData, botToken: env.TELEGRAM_BOT_TOKEN })
    if (!validation.ok) {
      res.status(401).json({ ok: false, message: validation.message })
      return
    }

    const existingUser = await telegramUsersRepository.findByTelegramUserId(validation.user.id)
    const telegramChatId = existingUser?.telegramChatId ?? validation.user.id
    await telegramUsersRepository.upsert({
      telegramUserId: validation.user.id,
      telegramChatId
    })

    await handler({
      telegramUserId: validation.user.id,
      telegramChatId
    })
  } catch (error) {
    const normalized = normalizeError(error)
    logger.error(toLogPayload(normalized, { scope: 'http', action: 'appApi' }))
    res.status(500).json({ ok: false, message: 'Не удалось выполнить действие.' })
  }
}
