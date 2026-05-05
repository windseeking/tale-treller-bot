import http from "node:http";
import path from "node:path";

import express, { type Express, type Request, type Response } from "express";
import type { ViteDevServer } from "vite";

import { env } from "../config/env.js";
import type { AppSessionRecord } from "../db/repositories/types.js";
import { normalizeError, toLogPayload } from "../errors/error-handler.js";
import { logger } from "../logger/logger.js";
import { TrelloAuthService } from "../auth/trello-auth-service.js";
import { SettingsService } from "../settings/settings-service.js";
import { isValidTimeZone, listTimeZoneOptions } from "../settings/time-zone.js";

const APP_STATIC_DIR = path.resolve("dist/public/app");

export function createHttpServer(authService: TrelloAuthService, settingsService: SettingsService): {
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const app = express();
  let server: http.Server | null = null;
  let viteServer: ViteDevServer | null = null;
  let frontendConfigured = false;

  app.use(express.json({ limit: "16kb" }));

  app.post("/api/app/session/exchange", async (req, res) => {
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const sid = "sid" in body && typeof body.sid === "string" ? body.sid : "";
    const secret = "secret" in body && typeof body.secret === "string" ? body.secret : "";

    if (!sid || !secret) {
      res.status(400).json({ ok: false, message: "Некорректная ссылка приложения." });
      return;
    }

    try {
      const result = await settingsService.exchangeAppSession({ sid, secret });
      if (!result.ok) {
        res.status(result.statusCode).json({ ok: false, message: result.message });
        return;
      }

      res.status(200).json({
        ok: true,
        token: result.token,
        ...(await buildAppPayload({
          session: result.session,
          authService,
          settingsService
        }))
      });
    } catch (error) {
      const normalized = normalizeError(error);
      logger.error(toLogPayload(normalized, { scope: "http", action: "appSessionExchange" }));
      res.status(500).json({ ok: false, message: "Не удалось открыть приложение." });
    }
  });

  app.get("/api/app/time-zones", async (_req, res) => {
    res.status(200).json({ ok: true, timeZones: listTimeZoneOptions() });
  });

  app.get("/api/app/me", async (req, res) => {
    await withAppSession(req, res, settingsService, async (session) => {
      res.status(200).json({
        ok: true,
        ...(await buildAppPayload({ session, authService, settingsService }))
      });
    });
  });

  app.patch("/api/app/settings", async (req, res) => {
    await withAppSession(req, res, settingsService, async (session) => {
      const body = typeof req.body === "object" && req.body !== null ? req.body : {};
      const timeZone = "timeZone" in body && typeof body.timeZone === "string" ? body.timeZone : "";

      if (!isValidTimeZone(timeZone)) {
        res.status(400).json({ ok: false, message: "Некорректный часовой пояс." });
        return;
      }

      await settingsService.saveTimeZone({ telegramUserId: session.telegramUserId, timeZone });
      res.status(200).json({
        ok: true,
        settings: await buildSettingsPayload(session.telegramUserId, settingsService)
      });
    });
  });

  app.get("/api/app/trello/status", async (req, res) => {
    await withAppSession(req, res, settingsService, async (session) => {
      res.status(200).json({
        ok: true,
        trello: await buildTrelloPayload(session.telegramUserId, authService)
      });
    });
  });

  app.post("/api/app/trello/connect-link", async (req, res) => {
    await withAppSession(req, res, settingsService, async (session) => {
      const link = await authService.createAuthorizationLink({
        telegramUserId: session.telegramUserId,
        telegramChatId: session.telegramChatId
      });
      res.status(200).json({ ok: true, url: link.url, expiresAt: link.expiresAt.toISOString() });
    });
  });

  app.post("/api/app/trello/disconnect", async (req, res) => {
    await withAppSession(req, res, settingsService, async (session) => {
      await authService.revokeConnection(session.telegramUserId);
      res.status(200).json({
        ok: true,
        trello: await buildTrelloPayload(session.telegramUserId, authService)
      });
    });
  });

  app.get("/auth/trello/start", async (req, res) => {
    const sid = typeof req.query.sid === "string" ? req.query.sid : "";
    const secret = typeof req.query.secret === "string" ? req.query.secret : "";

    if (!sid || !secret) {
      res.status(400).send(renderHtml("Ошибка", "Некорректная ссылка авторизации."));
      return;
    }

    try {
      const result = await authService.startAuthRedirect({ sid, secret });
      if (!result.ok) {
        res.status(result.statusCode).send(renderHtml("Ошибка авторизации", result.reason));
        return;
      }

      res.redirect(302, result.redirectUrl);
    } catch (error) {
      const normalized = normalizeError(error);
      logger.error(toLogPayload(normalized, { scope: "http", action: "authStart" }));
      res
        .status(500)
        .send(renderHtml("Ошибка", "Не удалось запустить авторизацию Trello. Попробуйте снова из Telegram."));
    }
  });

  app.get("/auth/trello/callback", async (req, res) => {
    const sid = typeof req.query.sid === "string" ? req.query.sid : "";
    const oauthToken = typeof req.query.oauth_token === "string" ? req.query.oauth_token : undefined;
    const oauthVerifier =
      typeof req.query.oauth_verifier === "string" ? req.query.oauth_verifier : undefined;
    const denied = typeof req.query.denied === "string" ? req.query.denied : undefined;

    if (!sid) {
      res.status(400).send(renderHtml("Ошибка", "Отсутствует идентификатор сессии."));
      return;
    }

    try {
      const result = await authService.handleCallback({ sid, oauthToken, oauthVerifier, denied });
      if (!result.ok) {
        res.status(400).send(renderHtml("Подключение не завершено", result.reason));
        return;
      }

      const resultUrl = new URL("/auth/trello/result", env.APP_BASE_URL);
      resultUrl.searchParams.set("status", "success");
      resultUrl.searchParams.set("message", result.reason);
      res.redirect(302, resultUrl.toString());
    } catch (error) {
      const normalized = normalizeError(error);
      logger.error(toLogPayload(normalized, { scope: "http", action: "authCallback" }));
      const resultUrl = new URL("/auth/trello/result", env.APP_BASE_URL);
      resultUrl.searchParams.set("status", "error");
      resultUrl.searchParams.set("message", "Не удалось завершить подключение Trello.");
      res.redirect(302, resultUrl.toString());
    }
  });

  app.get("/auth/trello/result", (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "error";
    const message =
      typeof req.query.message === "string"
        ? req.query.message
        : "Произошла ошибка. Вернитесь в Telegram и повторите попытку.";

    const title = status === "success" ? "Вы авторизованы в Trello" : "Подключение Trello";
    res.status(status === "success" ? 200 : 400).send(renderHtml(title, message));
  });

  app.get("/settings/time-zone/auto", (req, res) => {
    const sid = typeof req.query.sid === "string" ? req.query.sid : "";
    const secret = typeof req.query.secret === "string" ? req.query.secret : "";

    if (!sid || !secret) {
      res.status(400).send(renderHtml("Ошибка", "Некорректная ссылка настройки."));
      return;
    }

    res.status(200).send(renderAutoTimeZoneHtml({ sid, secret }));
  });

  app.post("/settings/time-zone/auto/complete", async (req, res) => {
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const sid = "sid" in body && typeof body.sid === "string" ? body.sid : "";
    const secret = "secret" in body && typeof body.secret === "string" ? body.secret : "";
    const timeZone = "timeZone" in body && typeof body.timeZone === "string" ? body.timeZone : "";

    if (!sid || !secret || !timeZone) {
      res.status(400).json({ ok: false, message: "Некорректные данные настройки." });
      return;
    }

    try {
      const result = await settingsService.completeAutoTimeZone({ sid, secret, timeZone });
      res.status(result.ok ? 200 : result.statusCode).json(result);
    } catch (error) {
      const normalized = normalizeError(error);
      logger.error(toLogPayload(normalized, { scope: "http", action: "settingsTimeZoneAutoComplete" }));
      res.status(500).json({ ok: false, message: "Не удалось сохранить часовой пояс." });
    }
  });

  return {
    start: async () => {
      if (!frontendConfigured) {
        server = http.createServer(app);
        viteServer = await configureAppFrontend(app, server);
        frontendConfigured = true;
      }

      await new Promise<void>((resolve, reject) => {
        const instance = server ?? http.createServer(app);
        instance.listen(env.APP_PORT, () => {
          server = instance;
          resolve();
        });

        instance.on("error", (error) => {
          reject(error);
        });
      });
    },
    stop: async () => {
      if (!server) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      server = null;
      await viteServer?.close();
      viteServer = null;
    }
  };
}

async function configureAppFrontend(app: Express, httpServer: http.Server): Promise<ViteDevServer | null> {
  if (env.NODE_ENV === "development") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const viteServer = await createViteServer({
        configFile: path.resolve("app/vite.config.ts"),
        server: {
          middlewareMode: true,
          hmr: {
            server: httpServer
          }
        }
      });

      app.use(viteServer.middlewares);
      logger.info({ scope: "http", action: "appDevServer" }, "Serving Telegram App through Vite middleware");
      return viteServer;
    } catch (error) {
      if (!isMissingViteError(error)) {
        throw error;
      }

      logger.warn(
        { scope: "http", action: "appDevServer" },
        "Vite is not available; serving built Telegram App assets"
      );
    }
  }

  app.use("/app/assets", express.static(path.join(APP_STATIC_DIR, "assets")));

  app.get("/app", (_req, res) => {
    res.sendFile(path.join(APP_STATIC_DIR, "index.html"), (error) => {
      if (!error) {
        return;
      }

      res
        .status(503)
        .send(renderHtml("Приложение недоступно", "App еще не собран. Запустите npm run build."));
    });
  });

  return null;
}

function isMissingViteError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ERR_MODULE_NOT_FOUND";
}

async function withAppSession(
  req: Request,
  res: Response,
  settingsService: SettingsService,
  handler: (session: AppSessionRecord) => Promise<void>
): Promise<void> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, message: "Требуется авторизация приложения." });
    return;
  }

  try {
    const session = await settingsService.findActiveAppSessionByToken(token);
    if (!session) {
      res.status(401).json({ ok: false, message: "Сессия приложения истекла." });
      return;
    }

    await handler(session);
  } catch (error) {
    const normalized = normalizeError(error);
    logger.error(toLogPayload(normalized, { scope: "http", action: "appApi" }));
    res.status(500).json({ ok: false, message: "Не удалось выполнить действие." });
  }
}

function getBearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

async function buildAppPayload(params: {
  session: AppSessionRecord;
  authService: TrelloAuthService;
  settingsService: SettingsService;
}) {
  return {
    user: {
      telegramUserId: params.session.telegramUserId,
      telegramChatId: params.session.telegramChatId
    },
    settings: await buildSettingsPayload(params.session.telegramUserId, params.settingsService),
    trello: await buildTrelloPayload(params.session.telegramUserId, params.authService)
  };
}

async function buildSettingsPayload(telegramUserId: number, settingsService: SettingsService) {
  const timeZone = await settingsService.findTimeZone(telegramUserId);

  return {
    timeZone,
    isDefaultTimeZone: !timeZone,
    defaultTimeZone: env.APP_TIMEZONE
  };
}

async function buildTrelloPayload(telegramUserId: number, authService: TrelloAuthService) {
  const status = await authService.getConnectionStatus(telegramUserId);

  return {
    connected: status.connected,
    username: status.username ?? null,
    expiresAt: status.expiresAt?.toISOString() ?? null,
    expired: Boolean(status.expired)
  };
}

function renderAutoTimeZoneHtml(params: { sid: string; secret: string }): string {
  const sidJson = JSON.stringify(params.sid);
  const secretJson = JSON.stringify(params.secret);

  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Определить часовой пояс</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 24px; background: #f7f7f5; color: #1f2937; }
      .card { max-width: 640px; margin: 40px auto; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
      h1 { margin: 0 0 12px; font-size: 22px; }
      p { line-height: 1.5; margin: 0 0 16px; }
      code { background: #f3f4f6; border-radius: 6px; padding: 2px 6px; }
      button { appearance: none; border: 0; border-radius: 8px; background: #2563eb; color: white; padding: 12px 16px; font-size: 16px; font-weight: 600; cursor: pointer; }
      button:disabled { background: #9ca3af; cursor: wait; }
      .hint { color: #6b7280; font-size: 14px; }
      .error { color: #b91c1c; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Часовой пояс</h1>
      <p id="detected">Определяю часовой пояс...</p>
      <button id="save" disabled>Сохранить</button>
      <p id="result" class="hint"></p>
    </div>
    <script>
      const sid = ${sidJson};
      const secret = ${secretJson};
      const saveButton = document.getElementById("save");
      const detected = document.getElementById("detected");
      const result = document.getElementById("result");

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timeZone) {
        detected.textContent = "Часовой пояс определен. Нажмите «Сохранить», чтобы использовать его в Telegram.";
        saveButton.disabled = false;
      } else {
        detected.textContent = "Не удалось определить часовой пояс в этом браузере.";
        result.className = "hint error";
      }

      saveButton.addEventListener("click", async () => {
        saveButton.disabled = true;
        result.textContent = "Сохраняю...";
        try {
          const response = await fetch("/settings/time-zone/auto/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sid, secret, timeZone })
          });
          const payload = await response.json();
          result.textContent = payload.message || "Готово. Вернитесь в Telegram.";
          if (!response.ok) {
            result.className = "hint error";
            saveButton.disabled = false;
          }
        } catch {
          result.textContent = "Не удалось сохранить. Попробуйте открыть ссылку еще раз из Telegram.";
          result.className = "hint error";
          saveButton.disabled = false;
        }
      });
    </script>
  </body>
</html>`;
}

function renderHtml(title: string, message: string): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 24px; background: #f7f7f5; color: #1f2937; }
      .card { max-width: 640px; margin: 40px auto; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
      h1 { margin: 0 0 12px; font-size: 22px; }
      p { line-height: 1.5; margin: 0 0 16px; }
      .hint { color: #6b7280; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <p class="hint">Вернитесь в Telegram-бот и продолжайте работу.</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
