import { Telegraf, type Context } from "telegraf";

import { AppError } from "../errors/app-error.js";
import { normalizeError } from "../errors/error-handler.js";
import { LlmClient } from "../llm/llm-client.js";
import { logger } from "../logger/logger.js";
import { TrelloClient } from "../trello/trello-client.js";
import type { TrelloBoard, TrelloList } from "../trello/types.js";
import { validateTaskTextLength } from "./card-content.js";
import {
  boardsKeyboard,
  cancelKeyboard,
  cardCreatedKeyboard,
  listsKeyboard,
  mainReplyKeyboard,
  reuseSelectionKeyboard
} from "./keyboards.js";
import { SessionStore } from "./session-store.js";

const BOT_TEXT = {
  welcome:
    "Привет! Я готов помочь с постановкой задач в Trello ✨\n\nПришли одно или несколько текстовых сообщений, а когда будешь готов — нажми кнопку *Создать задачу*.",
  tooShort: (length: number) =>
    `Пока маловато текста: ${length} символов. Нужно минимум 15. Добавь деталей и снова нажми *Создать задачу*.`,
  draftEmpty:
    "Пока не вижу текста задачи. Пришли сообщения с деталями, затем нажми *Создать задачу*.",
  pickBoard: "Отлично, теперь выбери доску, где создать карточку:",
  noBoards: "Не нашла доступные доски для этого пользователя Trello 🕵",
  reuseSelection: (boardName: string, listName: string) =>
    `Доска: *${boardName}*\nКолонка: *${listName}*\n\nСоздать карточку тут?`,
  pickList: "Теперь выбери список:",
  boardSelected: (boardName: string) => `Доска: *${boardName}*`,
  listSelected: (listName: string) => `Колонка: *${listName}*`,
  noLists: "В этой доске пока нет доступных колонок 😕 Давай выберем другую доску.",
  canceled:
    "Ок, задачу отменила ✋ Текущий черновик сброшен, можешь присылать новые сообщения для следующей задачи.",
  boardChanged: "Хорошо, давай выберем другую доску 🔄",
  waitLastSelection: "Выбери один из вариантов ниже 👇",
  waitBoard: "Сначала выбери доску из кнопок ниже 👇",
  waitList: "Сначала выбери колонку из кнопок ниже 👇",
  cardCreated: (cardName: string, cardShortUrl: string) =>
    `Готово! 🎉 Карточка *${cardName}* создана.\nСсылка: ${cardShortUrl}`,
  cardInProgress: "Принято! Собираю карточку и отправляю в Trello ⏳",
  readyForNextDraft: "Готов к новой задаче ✍️ Пришли сообщения и нажми *Создать задачу*.",
  genericError: "Ой, что-то пошло не так 😔 Попробуй еще раз.",
  unsupportedMessage: "Пока поддерживаются только текстовые сообщения 💬"
};

type Dependencies = {
  telegramToken: string;
  trelloClient: TrelloClient;
  llmClient: LlmClient;
};

type BotSession = ReturnType<SessionStore["get"]>;

export function createTelegramBot({ telegramToken, trelloClient, llmClient }: Dependencies): Telegraf {
  const bot = new Telegraf(telegramToken);
  const sessions = new SessionStore();

  bot.start(async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    if (chatId === undefined) {
      return;
    }
    sessions.resetTask(chatId);
    await replyMarkdown(ctx, BOT_TEXT.welcome, { reply_markup: mainReplyKeyboard() });
  });

  bot.command("cancel", async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    if (chatId === undefined) {
      return;
    }
    sessions.resetTask(chatId);
    await replyMarkdown(ctx, BOT_TEXT.canceled, { reply_markup: mainReplyKeyboard() });
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
        return;
      }

      if (session.stage === "selecting_list") {
        await replyMarkdown(ctx, BOT_TEXT.waitList);
        return;
      }

      if (session.stage === "confirming_last_selection") {
        await replyMarkdown(ctx, BOT_TEXT.waitLastSelection);
        return;
      }

      const text = message.text.trim();
      if (!text) {
        return;
      }

      if (text === "Отмена") {
        await tryDeleteIncomingMessage(ctx);
        sessions.resetTask(chatId);
        await replyMarkdown(ctx, BOT_TEXT.canceled, { reply_markup: mainReplyKeyboard() });
        return;
      }

      if (text === "Создать задачу") {
        await tryDeleteIncomingMessage(ctx);
        await hideMainReplyKeyboard(ctx);
        const validation = validateTaskTextLength(session.messages);

        if (session.messages.length === 0) {
          await replyMarkdown(ctx, BOT_TEXT.draftEmpty, { reply_markup: mainReplyKeyboard() });
          return;
        }

        if (!validation.ok) {
          await replyMarkdown(ctx, BOT_TEXT.tooShort(validation.currentLength), {
            reply_markup: mainReplyKeyboard()
          });
          return;
        }

        if (hasLastSelection(session)) {
          session.stage = "confirming_last_selection";
          await replyMarkdown(
            ctx,
            BOT_TEXT.reuseSelection(
              escapeMarkdown(session.lastBoardName ?? ""),
              escapeMarkdown(session.lastListName ?? "")
            ),
            { reply_markup: reuseSelectionKeyboard() }
          );
          return;
        }

        await sendBoards(ctx, trelloClient, session);
        return;
      }

      session.messages.push(text);
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
        await replyMarkdown(ctx, BOT_TEXT.canceled, { reply_markup: mainReplyKeyboard() });
        return;
      }

      if (data === "action:change_board") {
        session.stage = "selecting_board";
        session.selectedBoardId = undefined;
        session.selectedBoardName = undefined;
        session.selectedListId = undefined;
        session.selectedListName = undefined;
        session.lists = [];
        await sendBoards(ctx, trelloClient, session, { inCallbackMessage: true, text: BOT_TEXT.boardChanged });
        return;
      }

      if (data === "action:use_last_selection") {
        if (!hasLastSelection(session)) {
          session.stage = "selecting_board";
          await sendBoards(ctx, trelloClient, session);
          return;
        }

        session.selectedBoardId = session.lastBoardId;
        session.selectedBoardName = session.lastBoardName;
        session.selectedListId = session.lastListId;
        session.selectedListName = session.lastListName;

        await replaceCallbackMessageText(
          ctx,
          `${BOT_TEXT.boardSelected(escapeMarkdown(session.selectedBoardName ?? ""))}\n${BOT_TEXT.listSelected(
            escapeMarkdown(session.selectedListName ?? "")
          )}`
        );
        await createCardFromCurrentSelection({ session, ctx, trelloClient, llmClient });
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
  session: BotSession;
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
  session.selectedListId = undefined;
  session.selectedListName = undefined;
  await replaceCallbackMessageText(ctx, BOT_TEXT.boardSelected(escapeMarkdown(selectedBoard.name)));

  const lists = await trelloClient.getBoardLists(selectedBoard.id);

  if (lists.length === 0) {
    await replyMarkdown(ctx, BOT_TEXT.noLists);
    await sendBoards(ctx, trelloClient, session);
    return;
  }

  session.stage = "selecting_list";
  session.lists = lists;

  await replyMarkdown(ctx, BOT_TEXT.pickList, { reply_markup: listsKeyboard(lists) });
}

async function onListSelected(params: {
  listId: string;
  session: BotSession;
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

  await replaceCallbackMessageText(ctx, BOT_TEXT.listSelected(escapeMarkdown(selectedList.name)));

  session.selectedListId = selectedList.id;
  session.selectedListName = selectedList.name;
  await createCardFromCurrentSelection({ session, ctx, trelloClient, llmClient });
}

async function createCardFromCurrentSelection(params: {
  session: BotSession;
  ctx: Context;
  trelloClient: TrelloClient;
  llmClient: LlmClient;
}): Promise<void> {
  const { session, ctx, trelloClient, llmClient } = params;

  if (!session.selectedListId || !session.selectedBoardId) {
    throw new AppError({
      message: "Selected board/list is required to create card",
      code: "SELECTION_REQUIRED"
    });
  }

  const progressMessage = await replyMarkdown(ctx, BOT_TEXT.cardInProgress);

  const cardInput = await llmClient.generateCardInput({
    messages: session.messages,
    idList: session.selectedListId
  });
  cardInput.desc = appendBotSignature(cardInput.desc);

  const card = await trelloClient.createCard(cardInput);

  await replaceBotMessageText(
    ctx,
    progressMessage.message_id,
    BOT_TEXT.cardCreated(escapeMarkdown(card.name), escapeMarkdown(card.shortUrl)),
    { reply_markup: cardCreatedKeyboard(card.shortUrl) }
  );

  session.lastBoardId = session.selectedBoardId;
  session.lastBoardName = session.selectedBoardName;
  session.lastListId = session.selectedListId;
  session.lastListName = session.selectedListName;

  session.stage = "collecting";
  session.messages = [];
  session.boards = [];
  session.lists = [];
  session.selectedBoardId = undefined;
  session.selectedBoardName = undefined;
  session.selectedListId = undefined;
  session.selectedListName = undefined;
  await replyMarkdown(ctx, BOT_TEXT.readyForNextDraft, { reply_markup: mainReplyKeyboard() });
}

async function sendBoards(
  ctx: Context,
  trelloClient: TrelloClient,
  session: BotSession,
  options?: { inCallbackMessage?: boolean; text?: string }
): Promise<void> {
  const boards = await trelloClient.getMemberBoards();
  session.boards = boards;
  session.stage = "selecting_board";
  const text = options?.text ?? BOT_TEXT.pickBoard;

  if (boards.length === 0) {
    if (options?.inCallbackMessage) {
      await replaceCallbackMessageText(ctx, BOT_TEXT.noBoards, { reply_markup: cancelKeyboard() });
      return;
    }

    await replyMarkdown(ctx, BOT_TEXT.noBoards, { reply_markup: cancelKeyboard() });
    return;
  }

  if (options?.inCallbackMessage) {
    await replaceCallbackMessageText(ctx, text, { reply_markup: boardsKeyboard(boards) });
    return;
  }

  await replyMarkdown(ctx, text, { reply_markup: boardsKeyboard(boards) });
}

function hasLastSelection(session: BotSession): boolean {
  return Boolean(
    session.lastBoardId && session.lastBoardName && session.lastListId && session.lastListName
  );
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
): Promise<Awaited<ReturnType<Context["reply"]>>> {
  return ctx.reply(text, { parse_mode: "Markdown", ...extra });
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

async function replaceCallbackMessageText(
  ctx: Context,
  text: string,
  extra?: {
    reply_markup?: ReturnType<typeof boardsKeyboard> | ReturnType<typeof cancelKeyboard>;
  }
): Promise<void> {
  try {
    await ctx.editMessageText(text, { parse_mode: "Markdown", ...extra });
  } catch (error) {
    const normalized = normalizeError(error);
    const message = normalized.message.toLowerCase();
    const isIgnorableError =
      message.includes("message is not modified") ||
      message.includes("message to edit not found") ||
      message.includes("message identifier is not specified") ||
      message.includes("message can't be edited");

    if (!isIgnorableError) {
      throw error;
    }

    await replyMarkdown(ctx, text, extra);
  }
}

async function replaceBotMessageText(
  ctx: Context,
  messageId: number,
  text: string,
  extra?: {
    reply_markup?: ReturnType<typeof cardCreatedKeyboard>;
  }
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) {
    await replyMarkdown(ctx, text, extra);
    return;
  }

  try {
    await ctx.telegram.editMessageText(chatId, messageId, undefined, text, {
      parse_mode: "Markdown",
      ...extra
    });
  } catch (error) {
    const normalized = normalizeError(error);
    const message = normalized.message.toLowerCase();
    const isIgnorableError =
      message.includes("message is not modified") ||
      message.includes("message to edit not found") ||
      message.includes("message can't be edited");

    if (isIgnorableError) {
      return;
    }

    await replyMarkdown(ctx, text, extra);
  }
}

async function tryDeleteIncomingMessage(ctx: Context): Promise<void> {
  try {
    await ctx.deleteMessage();
  } catch (error) {
    const normalized = normalizeError(error);
    const message = normalized.message.toLowerCase();
    const isIgnorableError =
      message.includes("message to delete not found") ||
      message.includes("message can't be deleted") ||
      message.includes("message can't be deleted for everyone");

    if (isIgnorableError) {
      return;
    }

    logger.warn(
      {
        code: normalized.code,
        message: normalized.message
      },
      "Could not delete incoming message"
    );
  }
}

async function hideMainReplyKeyboard(ctx: Context): Promise<void> {
  try {
    const chatId = ctx.chat?.id;
    const markerMessage = await ctx.reply("\u2063", {
      reply_markup: { remove_keyboard: true }
    });

    if (chatId === undefined) {
      return;
    }

    try {
      await ctx.telegram.deleteMessage(chatId, markerMessage.message_id);
    } catch {
      // Ignore cleanup errors: keyboard is already removed at this point.
    }
  } catch (error) {
    const normalized = normalizeError(error);
    logger.warn(
      {
        code: normalized.code,
        message: normalized.message
      },
      "Could not hide main reply keyboard"
    );
  }
}

function appendBotSignature(desc: string): string {
  const signature = "Task created with [@taletrellerbot](https://t.me/taletrellerbot).";
  const trimmedDesc = desc.trimEnd();

  return `${trimmedDesc}\n\n${signature}`;
}
