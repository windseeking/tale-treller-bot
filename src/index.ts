import { TrelloAuthService } from "./auth/trello-auth-service.js";
import { createTelegramBot } from "./bot/telegram-bot.js";
import { env } from "./config/env.js";
import { DbClient } from "./db/client.js";
import { runMigrations } from "./db/migrations.js";
import { TrelloAuthSessionsRepository } from "./db/repositories/trello-auth-sessions-repository.js";
import { TrelloConnectionsRepository } from "./db/repositories/trello-connections-repository.js";
import { TelegramUsersRepository } from "./db/repositories/telegram-users-repository.js";
import { UserSettingsRepository } from "./db/repositories/user-settings-repository.js";
import { normalizeError, toLogPayload } from "./errors/error-handler.js";
import { createHttpServer } from "./http/server.js";
import { LlmClient } from "./llm/llm-client.js";
import { logger } from "./logger/logger.js";
import { SettingsService } from "./settings/settings-service.js";
import { TrelloClient } from "./trello/trello-client.js";

let shuttingDown = false;
let stopBot: (() => Promise<void>) | null = null;
let stopHttp: (() => Promise<void>) | null = null;
let closeDb: (() => Promise<void>) | null = null;

async function bootstrap(): Promise<void> {
  const db = new DbClient();
  closeDb = async () => {
    await db.close();
  };

  await runMigrations(db);

  const trelloClient = new TrelloClient();
  const llmClient = new LlmClient();

  const telegramUsersRepository = new TelegramUsersRepository(db);
  const trelloConnectionsRepository = new TrelloConnectionsRepository(db);
  const trelloAuthSessionsRepository = new TrelloAuthSessionsRepository(db);
  const userSettingsRepository = new UserSettingsRepository(db);
  const settingsService = new SettingsService(userSettingsRepository);

  const trelloAuthService = new TrelloAuthService(
    telegramUsersRepository,
    trelloConnectionsRepository,
    trelloAuthSessionsRepository,
    userSettingsRepository
  );

  const httpServer = createHttpServer(trelloAuthService, settingsService, telegramUsersRepository);
  await httpServer.start();
  stopHttp = async () => {
    await httpServer.stop();
  };

  const bot = createTelegramBot({
    telegramToken: env.TELEGRAM_BOT_TOKEN,
    trelloClient,
    llmClient,
    trelloAuthService,
    telegramUsersRepository,
    userSettingsRepository
  });

  logger.info(
    {
      nodeEnv: env.NODE_ENV,
      appPort: env.APP_PORT
    },
    "Telegram Trello bot bootstrap initialized"
  );

  bot.catch((error: unknown) => {
    const normalized = normalizeError(error);
    logger.error(toLogPayload(normalized, { scope: "telegram", action: "middleware" }));
  });

  await bot.launch();
  stopBot = async () => {
    bot.stop("shutdown");
  };

  logger.info("Telegram bot and HTTP auth server started.");
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.warn({ signal }, "Shutdown signal received");

  if (stopBot) {
    await stopBot();
  }

  if (stopHttp) {
    await stopHttp();
  }

  if (closeDb) {
    await closeDb();
  }

  logger.info("Application stopped");
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  const error = normalizeError(reason);
  logger.error(toLogPayload(error, { scope: "process", action: "unhandledRejection" }));
});

process.on("uncaughtException", (exception) => {
  const error = normalizeError(exception);
  logger.fatal(toLogPayload(error, { scope: "process", action: "uncaughtException" }));
  process.exit(1);
});

void bootstrap().catch((error) => {
  const normalized = normalizeError(error);
  logger.fatal(toLogPayload(normalized, { scope: "bootstrap" }));
  process.exit(1);
});
