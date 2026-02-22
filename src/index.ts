import { env } from "./config/env.js";
import { normalizeError, toLogPayload } from "./errors/error-handler.js";
import { logger } from "./logger/logger.js";
import { createTelegramBot } from "./bot/telegram-bot.js";
import { TrelloClient } from "./trello/trello-client.js";

let shuttingDown = false;
let stopBot: (() => Promise<void>) | null = null;

async function bootstrap(): Promise<void> {
  const trelloClient = new TrelloClient();
  const bot = createTelegramBot({
    telegramToken: env.TELEGRAM_BOT_TOKEN,
    trelloClient
  });

  logger.info(
    {
      nodeEnv: env.NODE_ENV
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

  logger.info("Telegram bot started.");
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
