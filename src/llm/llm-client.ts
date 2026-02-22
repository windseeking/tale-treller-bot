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
        // temperature: 0.2,
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
    const body = tryParseJson(bodyText);

    if (!response.ok) {
      throw new AppError({
        message: "LLM API request failed",
        code: "LLM_API_ERROR",
        statusCode: response.status,
        details: {
          status: response.status,
          response: body ?? bodyText
        }
      });
    }

    const parsedResponse = openAiResponseSchema.safeParse(body);
    if (!parsedResponse.success) {
      throw new AppError({
        message: "LLM API response has invalid shape",
        code: "LLM_RESPONSE_INVALID",
        details: parsedResponse.error.flatten()
      });
    }

    const content = parsedResponse.data.choices[0]?.message.content ?? "";
    const outputPayload = extractJsonObject(content);
    if (!outputPayload) {
      throw new AppError({
        message: "LLM response does not contain JSON object",
        code: "LLM_OUTPUT_PARSE_ERROR",
        details: { content }
      });
    }

    const llmOutput = llmOutputSchema.safeParse(outputPayload);
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

function tryParseJson(value: string): unknown | null {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractJsonObject(content: string): unknown | null {
  const parsed = tryParseJson(content);
  if (parsed && typeof parsed === "object") {
    return parsed;
  }

  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const slice = content.slice(start, end + 1);
  return tryParseJson(slice);
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
