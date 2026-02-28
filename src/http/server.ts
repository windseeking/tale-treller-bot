import http from "node:http";

import express from "express";

import { env } from "../config/env.js";
import { normalizeError, toLogPayload } from "../errors/error-handler.js";
import { logger } from "../logger/logger.js";
import { TrelloAuthService } from "../auth/trello-auth-service.js";

export function createHttpServer(authService: TrelloAuthService): {
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const app = express();
  let server: http.Server | null = null;

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

  return {
    start: async () => {
      await new Promise<void>((resolve, reject) => {
        const instance = app.listen(env.APP_PORT, () => {
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
    }
  };
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
