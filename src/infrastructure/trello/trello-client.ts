import { AppError } from '../../errors/app-error.js'
import type { BoardsGateway } from '#interfaces/trello/boards/boards-gateway.js'
import type { TrelloCardsGateway } from '#interfaces/trello/cards/trello-cards-gateway.js'
import type { ListsGateway } from '#interfaces/trello/lists/lists-gateway.js'
import { ValidationError } from '../../errors/validation-error.js'
import trelloBoardsValidator from '#validators/trello/boards.js'
import trelloCardValidator from '#validators/trello/card.js'
import trelloErrorValidator from '#validators/trello/error.js'
import trelloListsValidator from '#validators/trello/lists.js'
import type { TrelloCard } from '#interfaces/trello/cards/trello-card.js'
import type { TrelloCardPayload } from '#interfaces/trello/cards/trello-card-payload.js'
import type { TrelloAuthContext } from '#interfaces/trello/auth/trello-auth-context.js'
import type { TrelloBoard } from '#interfaces/trello/boards/trello-board.js'
import type { TrelloList } from '#interfaces/trello/lists/trello-list.js'

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

export class TrelloClient implements BoardsGateway, ListsGateway, TrelloCardsGateway {
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

    return validateTrelloPayload(payload, trelloBoardsValidator, 'TRELLO_BOARDS_VALIDATION_ERROR')
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

    return validateTrelloPayload(payload, trelloListsValidator, 'TRELLO_LISTS_VALIDATION_ERROR')
  }

  public async createCard(payload: TrelloCardPayload, auth: TrelloAuthContext): Promise<TrelloCard> {
    const response = await this.request({
      path: '/cards',
      auth,
      options: {
        method: 'POST',
        query: {
          name: payload.name,
          desc: payload.desc,
          pos: payload.pos,
          idList: payload.idList,
          due: payload.due,
          urlSource: payload.urlSource,
          fields: 'id,name,desc,url,shortUrl,idList,idBoard'
        }
      }
    })

    return validateTrelloPayload(response, trelloCardValidator, 'TRELLO_CARD_VALIDATION_ERROR')
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
        ? trelloErrorValidator.validate(params.payload)
        : null

    const message =
      trelloError && trelloError.errors.length === 0 && (trelloError.data.message ?? trelloError.data.error)
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

function validateTrelloPayload<T>(
  payload: unknown,
  validator: { validate(data: unknown): { data: T; errors: Array<{ field: string; message: string }> } },
  code: string
): T {
  const result = validator.validate(payload)
  if (result.errors.length > 0) {
    throw new ValidationError({
      message: 'Trello API response validation failed',
      code,
      details: result.errors
    })
  }

  return result.data
}
