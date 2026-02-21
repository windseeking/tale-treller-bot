import { env } from "./config/env.js";
import { normalizeError, toLogPayload } from "./errors/error-handler.js";
import { logger } from "./logger/logger.js";
import { TrelloClient } from "./trello/trello-client.js";

let shuttingDown = false;

async function bootstrap(): Promise<void> {
  const trelloClient = new TrelloClient();

  logger.info(
    {
      nodeEnv: env.NODE_ENV
    },
    "Telegram Trello bot bootstrap initialized"
  );

  logger.info("Infrastructure is ready. Trello API client initialized.");
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.warn({ signal }, "Shutdown signal received");
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
