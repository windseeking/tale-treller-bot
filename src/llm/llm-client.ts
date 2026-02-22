import { readFileSync } from "node:fs";
import { z } from "zod";

import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import type { CreateTrelloCardInput } from "../trello/types.js";
import { collectTaskText } from "../bot/card-content.js";

const llmOutputSchema = z.object({
  name: z.string().min(1),
  desc: z.string().min(1),
  pos: z.literal("top").default("top"),
  idList: z.string().min(1),
  due: z.preprocess(normalizeDueDate, z.iso.datetime({ offset: true })).optional(),
  urlSource: z.url().optional()
});

const openAiResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable()
        })
      })
    )
    .min(1)
});

type GenerateCardInputParams = {
  messages: string[];
  idList: string;
};

export class LlmClient {
  private readonly baseUrl = env.LLM_BASE_URL ?? "https://api.openai.com/v1";
  private readonly systemPrompt = loadSystemPrompt();

  public async generateCardInput(params: GenerateCardInputParams): Promise<CreateTrelloCardInput> {
    const taskText = collectTaskText(params.messages);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: this.systemPrompt
          },
          {
            role: "user",
            content: buildUserPrompt({ taskText, idList: params.idList })
          }
        ]
      })
    });

    const bodyText = await response.text();
    const parsedBody = tryParseJson(bodyText);
    const body = parsedBody.value;

    if (!response.ok) {
      throw new AppError({
        message: "LLM API request failed",
        code: "LLM_API_ERROR",
        statusCode: response.status,
        details: {
          status: response.status,
          response: body ?? bodyText,
          parseError: parsedBody.error
        }
      });
    }

    if (!body || typeof body !== "object") {
      throw new AppError({
        message: "LLM API response is not valid JSON",
        code: "LLM_RESPONSE_INVALID",
        details: {
          parseError: parsedBody.error ?? "Unknown parse error",
          bodyPreview: truncateForDebug(bodyText, 2000)
        }
      });
    }

    const content = extractLlmContent(body);
    const outputPayload = extractJsonObject(content);
    if (!outputPayload.value) {
      throw new AppError({
        message: "LLM response does not contain JSON object",
        code: "LLM_OUTPUT_PARSE_ERROR",
        details: {
          content,
          parseError: outputPayload.error,
          attemptedPayloadPreview: outputPayload.attemptedPayloadPreview
        }
      });
    }

    const llmOutput = llmOutputSchema.safeParse(outputPayload.value);
    if (!llmOutput.success) {
      throw new AppError({
        message: "LLM output validation failed",
        code: "LLM_OUTPUT_VALIDATION_ERROR",
        details: llmOutput.error.flatten()
      });
    }

    return {
      name: llmOutput.data.name,
      desc: llmOutput.data.desc,
      pos: "top",
      idList: params.idList,
      due: llmOutput.data.due,
      urlSource: llmOutput.data.urlSource
    };
  }
}

function buildUserPrompt(params: { taskText: string; idList: string }): string {
  const today = getTodayInTimeZone(env.APP_TIMEZONE);

  return [
    `idList for the card: ${params.idList}`,
    `Current date: ${today}`,
    `Timezone: ${env.APP_TIMEZONE}`,
    "User's original message:",
    params.taskText
  ].join("\n\n");
}

function tryParseJson(value: string): { value: unknown | null; error?: string } {
  if (!value) {
    return { value: null, error: "Empty input string" };
  }

  try {
    return { value: JSON.parse(value) };
  } catch (error) {
    return { value: null, error: extractJsonParseError(error) };
  }
}

function extractJsonObject(content: string): {
  value: unknown | null;
  error?: string;
  attemptedPayloadPreview?: string;
} {
  const directCandidate = sanitizeJsonCandidate(content);
  const directResult = tryParseJson(directCandidate);
  if (directResult.value && typeof directResult.value === "object") {
    return { value: directResult.value };
  }

  const start = directCandidate.indexOf("{");
  const end = directCandidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return {
      value: null,
      error: directResult.error ?? "Could not find JSON object boundaries",
      attemptedPayloadPreview: truncateForDebug(directCandidate, 1200)
    };
  }

  const slice = directCandidate.slice(start, end + 1);
  const slicedResult = tryParseJson(slice);

  if (slicedResult.value && typeof slicedResult.value === "object") {
    return { value: slicedResult.value };
  }

  return {
    value: null,
    error: slicedResult.error ?? directResult.error,
    attemptedPayloadPreview: truncateForDebug(slice, 1200)
  };
}

function normalizeDueDate(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T23:59:00.000Z`;
  }

  return trimmed;
}

function loadSystemPrompt(): string {
  const promptUrl = new URL("./prompts/system-prompt.md", import.meta.url);

  return readFileSync(promptUrl, "utf-8").trim();
}

function sanitizeJsonCandidate(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/\uFEFF/g, "")
    .replace(/[\u200B-\u200D\u2060]/g, "");
}

function extractJsonParseError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown JSON.parse error";
}

function truncateForDebug(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}... [truncated, original length=${value.length}]`;
}

function getTodayInTimeZone(timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new AppError({
      message: "Could not resolve current date for APP_TIMEZONE",
      code: "TIMEZONE_DATE_RESOLUTION_ERROR",
      details: { timeZone }
    });
  }

  return `${year}-${month}-${day}`;
}

function extractLlmContent(body: unknown): string {
  const parsedChatCompletions = openAiResponseSchema.safeParse(body);
  if (parsedChatCompletions.success) {
    return parsedChatCompletions.data.choices[0]?.message.content ?? "";
  }

  const parsedContentFromChoices = extractContentFromChoices(body);
  if (parsedContentFromChoices) {
    return parsedContentFromChoices;
  }

  const parsedResponsesApi = extractContentFromResponsesApi(body);
  if (parsedResponsesApi) {
    return parsedResponsesApi;
  }

  throw new AppError({
    message: "LLM API response has invalid shape",
    code: "LLM_RESPONSE_INVALID",
    details: {
      expected: "chat.completions choices[] or responses output/output_text",
      bodyPreview: truncateForDebug(JSON.stringify(body ?? null), 2000)
    }
  });
}

function extractContentFromChoices(body: unknown): string | null {
  if (!isRecord(body) || !Array.isArray(body.choices) || body.choices.length === 0) {
    return null;
  }

  const firstChoice = body.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return null;
  }

  const rawContent = firstChoice.message.content;
  if (typeof rawContent === "string") {
    return rawContent;
  }

  if (Array.isArray(rawContent)) {
    const text = rawContent
      .map((item) => {
        if (isRecord(item) && typeof item.text === "string") {
          return item.text;
        }

        return "";
      })
      .join("")
      .trim();

    return text.length > 0 ? text : null;
  }

  return null;
}

function extractContentFromResponsesApi(body: unknown): string | null {
  if (!isRecord(body)) {
    return null;
  }

  if (typeof body.output_text === "string" && body.output_text.trim().length > 0) {
    return body.output_text;
  }

  if (!Array.isArray(body.output)) {
    return null;
  }

  const texts: string[] = [];

  for (const outputItem of body.output) {
    if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (isRecord(contentItem) && typeof contentItem.text === "string") {
        texts.push(contentItem.text);
      }
    }
  }

  const content = texts.join("").trim();
  return content.length > 0 ? content : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
