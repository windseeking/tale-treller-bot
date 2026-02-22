import { Telegraf, type Context } from "telegraf";

import { AppError } from "../errors/app-error.js";
import { normalizeError } from "../errors/error-handler.js";
import { LlmClient } from "../llm/llm-client.js";
import { logger } from "../logger/logger.js";
import { TrelloClient } from "../trello/trello-client.js";
import type { TrelloBoard, TrelloList } from "../trello/types.js";
import { validateTaskTextLength } from "./card-content.js";
import { boardsKeyboard, cancelKeyboard, cardCreatedKeyboard, listsKeyboard } from "./keyboards.js";
import { SessionStore } from "./session-store.js";

const BOT_TEXT = {
  welcome:
    "Привет! Я готов помочь с постановкой задач в Trello ✨\n\nПришли одно или несколько текстовых сообщений.",
  tooShort: (length: number) =>
    `Пока маловато текста: ${length} символов. Нужно минимум 15. Пришли, пожалуйста, еще немного деталей.`,
  pickBoard: "Отлично, теперь выбери доску, где создать карточку:",
  noBoards: "Не нашла доступные доски для этого пользователя Trello 🕵",
  pickList: (boardName: string) => `Выбрали доску: *${boardName}* ✅\nТеперь выбери колонку (список):`,
  noLists: "В этой доске пока нет доступных колонок 😕 Давай выберем другую доску.",
  canceled: "Ок, отменил постановку задачи ✋ Можешь прислать новый текст.",
  boardChanged: "Хорошо, давай выберем другую доску 🔄",
  waitBoard: "Сначала выбери доску из кнопок ниже 👇",
  waitList: "Сначала выбери колонку из кнопок ниже 👇",
  cardCreated: (cardName: string, boardName: string, cardShortUrl: string) =>
    `Готово! Карточка *${cardName}* создана на доске *${boardName}* 🎉\nСсылка: ${cardShortUrl}`,
  cardInProgress: "Принято! Собираю карточку и отправляю в Trello ⏳",
  genericError: "Ой, что-то пошло не так 😔 Попробуй еще раз.",
  unsupportedMessage: "Пока поддерживаются только текстовые сообщения 💬"
};

type Dependencies = {
  telegramToken: string;
  trelloClient: TrelloClient;
  llmClient: LlmClient;
};

export function createTelegramBot({ telegramToken, trelloClient, llmClient }: Dependencies): Telegraf {
  const bot = new Telegraf(telegramToken);
  const sessions = new SessionStore();

  bot.start(async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    if (chatId === undefined) {
      return;
    }
    sessions.resetTask(chatId);
    await replyMarkdown(ctx, BOT_TEXT.welcome);
  });

  bot.command("cancel", async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    if (chatId === undefined) {
      return;
    }
    sessions.resetTask(chatId);
    await replyMarkdown(ctx, BOT_TEXT.canceled);
  });

  bot.on("text", async (ctx: Context) => {
    try {
      const chatId = ctx.chat?.id;
      if (chatId === undefined) {
        return;
      }
      const message = ctx.message;
      if (!message || !("text" in message)) {
        return;
      }
      const session = sessions.get(chatId);

      if (session.stage === "selecting_board") {
        await replyMarkdown(ctx, BOT_TEXT.waitBoard);
        await sendBoards(ctx, trelloClient, session);
        return;
      }

      if (session.stage === "selecting_list") {
        await replyMarkdown(ctx, BOT_TEXT.waitList);
        return;
      }

      const text = message.text.trim();
      if (!text) {
        return;
      }

      session.messages.push(text);
      const validation = validateTaskTextLength(session.messages);

      if (!validation.ok) {
        await replyMarkdown(ctx, BOT_TEXT.tooShort(validation.currentLength));
        return;
      }

      await sendBoards(ctx, trelloClient, session);
    } catch (error) {
      const normalized = normalizeError(error);
      logger.error(
        {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details
        },
        "Telegram text handling failed"
      );
      await ctx.reply(formatBotError(normalized), { parse_mode: "HTML" });
    }
  });

  bot.on("message", async (ctx: Context, next: () => Promise<void>) => {
    const message = ctx.message;
    if (message && "text" in message) {
      await next();
      return;
    }
    await replyMarkdown(ctx, BOT_TEXT.unsupportedMessage);
  });

  bot.on("callback_query", async (ctx: Context) => {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !("data" in callbackQuery)) {
      return;
    }

    const chatId = ctx.chat?.id;
    if (chatId === undefined) {
      return;
    }

    const data = callbackQuery.data;
    const session = sessions.get(chatId);

    try {
      await safeAnswerCbQuery(ctx);

      if (data === "action:cancel") {
        sessions.resetTask(chatId);
        await replyMarkdown(ctx, BOT_TEXT.canceled);
        return;
      }

      if (data === "action:change_board") {
        session.stage = "selecting_board";
        session.selectedBoardId = undefined;
        session.selectedBoardName = undefined;
        session.lists = [];
        await replyMarkdown(ctx, BOT_TEXT.boardChanged);
        await sendBoards(ctx, trelloClient, session);
        return;
      }

      if (data.startsWith("board:")) {
        const boardId = data.replace("board:", "");
        await onBoardSelected({ boardId, session, ctx, trelloClient });
        return;
      }

      if (data.startsWith("list:")) {
        const listId = data.replace("list:", "");
        await onListSelected({ listId, session, ctx, trelloClient, llmClient });
        return;
      }
    } catch (error) {
      const normalized = normalizeError(error);
      logger.error(
        {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details
        },
        "Telegram callback handling failed"
      );
      await ctx.reply(formatBotError(normalized), { parse_mode: "HTML" });
    }
  });

  return bot;
}

async function onBoardSelected(params: {
  boardId: string;
  session: {
    stage: "collecting" | "selecting_board" | "selecting_list";
    messages: string[];
    boards: TrelloBoard[];
    lists: TrelloList[];
    selectedBoardId?: string;
    selectedBoardName?: string;
  };
  ctx: Context;
  trelloClient: TrelloClient;
}): Promise<void> {
  const { boardId, session, ctx, trelloClient } = params;

  const selectedBoard = session.boards.find((board) => board.id === boardId);
  if (!selectedBoard) {
    await replyMarkdown(ctx, BOT_TEXT.pickBoard, { reply_markup: boardsKeyboard(session.boards) });
    return;
  }

  session.selectedBoardId = selectedBoard.id;
  session.selectedBoardName = selectedBoard.name;

  const lists = await trelloClient.getBoardLists(selectedBoard.id);

  if (lists.length === 0) {
    await replyMarkdown(ctx, BOT_TEXT.noLists);
    await sendBoards(ctx, trelloClient, session);
    return;
  }

  session.stage = "selecting_list";
  session.lists = lists;

  await replyMarkdown(ctx, BOT_TEXT.pickList(escapeMarkdown(selectedBoard.name)), {
    reply_markup: listsKeyboard(lists)
  });
}

async function onListSelected(params: {
  listId: string;
  session: {
    stage: "collecting" | "selecting_board" | "selecting_list";
    messages: string[];
    boards: TrelloBoard[];
    lists: TrelloList[];
    selectedBoardId?: string;
    selectedBoardName?: string;
  };
  ctx: Context;
  trelloClient: TrelloClient;
  llmClient: LlmClient;
}): Promise<void> {
  const { listId, session, ctx, trelloClient, llmClient } = params;

  const selectedList = session.lists.find((list) => list.id === listId);
  if (!selectedList) {
    await replyMarkdown(ctx, BOT_TEXT.waitList, { reply_markup: listsKeyboard(session.lists) });
    return;
  }

  await replyMarkdown(ctx, BOT_TEXT.cardInProgress);

  const cardInput = await llmClient.generateCardInput({
    messages: session.messages,
    idList: selectedList.id
  });

  const card = await trelloClient.createCard(cardInput);

  await replyMarkdown(
    ctx,
    BOT_TEXT.cardCreated(
      escapeMarkdown(card.name),
      escapeMarkdown(session.selectedBoardName ?? "неизвестная доска"),
      card.shortUrl
    ),
    { reply_markup: cardCreatedKeyboard(card.shortUrl) }
  );
  session.stage = "collecting";
  session.messages = [];
  session.boards = [];
  session.lists = [];
  session.selectedBoardId = undefined;
  session.selectedBoardName = undefined;
}

async function sendBoards(
  ctx: Context,
  trelloClient: TrelloClient,
  session: {
    stage: "collecting" | "selecting_board" | "selecting_list";
    boards: TrelloBoard[];
  }
): Promise<void> {
  const boards = await trelloClient.getMemberBoards();
  session.boards = boards;
  session.stage = "selecting_board";

  if (boards.length === 0) {
    await replyMarkdown(ctx, BOT_TEXT.noBoards, { reply_markup: cancelKeyboard() });
    return;
  }

  await replyMarkdown(ctx, BOT_TEXT.pickBoard, { reply_markup: boardsKeyboard(boards) });
}

function formatBotError(error: AppError): string {
  const debug = JSON.stringify(
    {
      code: error.code,
      message: error.message,
      details: error.details
    },
    null,
    2
  );

  return `${BOT_TEXT.genericError}\n\n<pre>${escapeHtml(debug)}</pre>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeMarkdown(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("_", "\\_")
    .replaceAll("*", "\\*")
    .replaceAll("`", "\\`")
    .replaceAll("[", "\\[");
}

async function replyMarkdown(
  ctx: Context,
  text: string,
  extra?: Parameters<Context["reply"]>[1]
): Promise<void> {
  await ctx.reply(text, { parse_mode: "Markdown", ...extra });
}

async function safeAnswerCbQuery(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch (error) {
    const normalized = normalizeError(error);
    const message = normalized.message.toLowerCase();
    const isExpiredQuery =
      message.includes("query is too old") || message.includes("query id is invalid");

    if (!isExpiredQuery) {
      throw error;
    }
  }
}
