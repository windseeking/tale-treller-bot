import { z } from 'zod'

import { AppError } from '../errors/app-error.js'
import type { CreateTrelloCardInput, TrelloAuthContext, TrelloBoard, TrelloCard, TrelloList } from './types.js'

const boardSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.url(),
  closed: z.boolean().default(false)
})

const listSchema = z.object({
  id: z.string(),
  name: z.string(),
  idBoard: z.string(),
  closed: z.boolean().default(false),
  pos: z.number()
})

const cardSchema = z.object({
  id: z.string(),
  name: z.string(),
  desc: z.string().default(''),
  url: z.url(),
  shortUrl: z.url(),
  idBoard: z.string(),
  idList: z.string()
})

const trelloErrorSchema = z.object({
  message: z.string().optional(),
  error: z.string().optional()
})

type RequestOptions = {
  method?: 'GET' | 'POST';
  query?: Record<string, string | undefined>;
};

type RequestDebug = {
  method: 'GET' | 'POST';
  url: string;
  urlLength: number;
  bodyLength: number;
  bodyPreview?: string;
};

export class TrelloClient {
  private readonly baseUrl = 'https://api.trello.com/1'

  public async getMemberBoards(auth: TrelloAuthContext): Promise<TrelloBoard[]> {
    const payload = await this.request({
      path: `/members/${auth.memberId}/boards`,
      auth,
      options: {
        method: 'GET',
        query: {
          fields: 'id,name,url,closed',
          filter: 'open'
        }
      }
    })

    return z.array(boardSchema).parse(payload)
  }

  public async getBoardLists(boardId: string, auth: TrelloAuthContext): Promise<TrelloList[]> {
    const payload = await this.request({
      path: `/boards/${boardId}/lists`,
      auth,
      options: {
        method: 'GET',
        query: {
          fields: 'id,name,idBoard,closed,pos',
          filter: 'open'
        }
      }
    })

    return z.array(listSchema).parse(payload)
  }

  public async createCard(input: CreateTrelloCardInput, auth: TrelloAuthContext): Promise<TrelloCard> {
    const payload = await this.request({
      path: '/cards',
      auth,
      options: {
        method: 'POST',
        query: {
          name: input.name,
          desc: input.desc,
          pos: input.pos,
          idList: input.idList,
          due: input.due,
          urlSource: input.urlSource
        }
      }
    })

    return cardSchema.parse(payload)
  }

  private async request(params: {
    path: string;
    auth: TrelloAuthContext;
    options?: RequestOptions;
  }): Promise<unknown> {
    const method = params.options?.method ?? 'GET'
    const requestQuery = params.options?.query ?? {}
    const url = this.buildUrl(params.path, params.auth, method === 'GET' ? requestQuery : undefined)
    const body = method === 'POST' ? this.toFormBody(requestQuery) : undefined

    const debugRequest: RequestDebug = {
      method,
      url: this.sanitizeUrl(url),
      urlLength: url.length,
      bodyLength: body?.length ?? 0,
      bodyPreview: body ? this.truncate(body, 1800) : undefined
    }

    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
      body
    })

    const bodyText = await response.text()
    const parsedBody = this.tryParseJson(bodyText)

    if (!response.ok) {
      throw this.toApiError({
        path: params.path,
        status: response.status,
        payload: parsedBody ?? bodyText,
        request: debugRequest
      })
    }

    return parsedBody ?? {}
  }

  private buildUrl(
    path: string,
    auth: TrelloAuthContext,
    query?: Record<string, string | undefined>
  ): string {
    const url = new URL(`${this.baseUrl}${path}`)

    url.searchParams.set('key', auth.apiKey)
    url.searchParams.set('token', auth.token)

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, value)
        }
      }
    }

    return url.toString()
  }

  private tryParseJson(value: string): unknown | null {
    if (!value) {
      return null
    }

    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  private toApiError(params: {
    path: string;
    status: number;
    payload: unknown;
    request: RequestDebug;
  }): AppError {
    const trelloError =
      typeof params.payload === 'object' && params.payload !== null
        ? trelloErrorSchema.safeParse(params.payload)
        : null

    const message =
      trelloError?.success && (trelloError.data.message ?? trelloError.data.error)
        ? `Trello API error: ${trelloError.data.message ?? trelloError.data.error}`
        : 'Trello API request failed'

    return new AppError({
      message,
      code: 'TRELLO_API_ERROR',
      statusCode: params.status,
      details: {
        path: params.path,
        status: params.status,
        response: params.payload,
        request: params.request
      }
    })
  }

  private toFormBody(data: Record<string, string | undefined>): string {
    const form = new URLSearchParams()

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        form.set(key, value)
      }
    }

    return form.toString()
  }

  private sanitizeUrl(rawUrl: string): string {
    const url = new URL(rawUrl)

    const key = url.searchParams.get('key')
    if (key) {
      url.searchParams.set('key', this.maskSecret(key))
    }

    const token = url.searchParams.get('token')
    if (token) {
      url.searchParams.set('token', this.maskSecret(token))
    }

    return url.toString()
  }

  private maskSecret(value: string): string {
    if (value.length <= 8) {
      return '***'
    }

    return `${value.slice(0, 4)}***${value.slice(-4)}`
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value
    }

    return `${value.slice(0, maxLength)}... [truncated, original length=${value.length}]`
  }
}
