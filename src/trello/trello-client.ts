import { z } from "zod";

import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import type { CreateTrelloCardInput, TrelloBoard, TrelloCard, TrelloList } from "./types.js";

const boardSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  closed: z.boolean().default(false)
});

const listSchema = z.object({
  id: z.string(),
  name: z.string(),
  idBoard: z.string(),
  closed: z.boolean().default(false),
  pos: z.number()
});

const cardSchema = z.object({
  id: z.string(),
  name: z.string(),
  desc: z.string().default(""),
  url: z.string().url(),
  shortUrl: z.string().url(),
  idBoard: z.string(),
  idList: z.string()
});

const trelloErrorSchema = z.object({
  message: z.string().optional(),
  error: z.string().optional()
});

type RequestOptions = {
  method?: "GET" | "POST";
  query?: Record<string, string | undefined>;
};

export class TrelloClient {
  private readonly baseUrl = "https://api.trello.com/1";

  public async getMemberBoards(): Promise<TrelloBoard[]> {
    const payload = await this.request({
      path: `/members/${env.TRELLO_MEMBER_ID}/boards`,
      options: {
        method: "GET",
        query: {
          fields: "id,name,url,closed",
          filter: "open"
        }
      }
    });

    return z.array(boardSchema).parse(payload);
  }

  public async getBoardLists(boardId: string): Promise<TrelloList[]> {
    const payload = await this.request({
      path: `/boards/${boardId}/lists`,
      options: {
        method: "GET",
        query: {
          fields: "id,name,idBoard,closed,pos",
          filter: "open"
        }
      }
    });

    return z.array(listSchema).parse(payload);
  }

  public async createCard(input: CreateTrelloCardInput): Promise<TrelloCard> {
    const payload = await this.request({
      path: "/cards",
      options: {
        method: "POST",
        query: {
          name: input.name,
          desc: input.desc,
          pos: input.pos,
          idList: input.idList,
          due: input.due,
          urlSource: input.urlSource
        }
      }
    });

    return cardSchema.parse(payload);
  }

  private async request(params: { path: string; options?: RequestOptions }): Promise<unknown> {
    const url = this.buildUrl(params.path, params.options?.query);
    const response = await fetch(url, {
      method: params.options?.method ?? "GET"
    });

    const bodyText = await response.text();
    const parsedBody = this.tryParseJson(bodyText);

    if (!response.ok) {
      throw this.toApiError({
        path: params.path,
        status: response.status,
        payload: parsedBody ?? bodyText
      });
    }

    return parsedBody ?? {};
  }

  private buildUrl(path: string, query?: Record<string, string | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`);

    url.searchParams.set("key", env.TRELLO_API_KEY);
    url.searchParams.set("token", env.TRELLO_TOKEN);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      }
    }

    return url.toString();
  }

  private tryParseJson(value: string): unknown | null {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private toApiError(params: { path: string; status: number; payload: unknown }): AppError {
    const trelloError =
      typeof params.payload === "object" && params.payload !== null
        ? trelloErrorSchema.safeParse(params.payload)
        : null;

    const message =
      trelloError?.success && (trelloError.data.message ?? trelloError.data.error)
        ? `Trello API error: ${trelloError.data.message ?? trelloError.data.error}`
        : "Trello API request failed";

    return new AppError({
      message,
      code: "TRELLO_API_ERROR",
      statusCode: params.status,
      details: {
        path: params.path,
        status: params.status,
        response: params.payload
      }
    });
  }
}
