import { AppError } from '../../../errors/app-error.js'
import type {
  TrelloAccessTokenResult,
  TrelloMemberGateway,
  TrelloMemberProfile,
  TrelloOAuthGateway,
  TrelloRequestTokenResult
} from '#interfaces/trello/auth/oauth-gateway.js'
import { buildOAuthHeader } from './trello-oauth.js'

const REQUEST_TOKEN_URL = 'https://trello.com/1/OAuthGetRequestToken'
const AUTHORIZE_TOKEN_URL = 'https://trello.com/1/OAuthAuthorizeToken'
const ACCESS_TOKEN_URL = 'https://trello.com/1/OAuthGetAccessToken'
const MEMBERS_ME_URL = 'https://api.trello.com/1/members/me'

export class TrelloOAuthHttpGateway implements TrelloOAuthGateway {
  public constructor(
    private readonly consumerKey: string,
    private readonly consumerSecret: string
  ) {}

  public async getRequestToken(callbackUrl: string): Promise<TrelloRequestTokenResult> {
    const authHeader = buildOAuthHeader({
      method: 'POST',
      url: REQUEST_TOKEN_URL,
      consumerKey: this.consumerKey,
      consumerSecret: this.consumerSecret,
      extraOAuthParams: {
        oauth_callback: callbackUrl
      }
    })

    const response = await fetch(REQUEST_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader
      }
    })
    const payloadText = await response.text()
    if (!response.ok) {
      throw new AppError({
        message: 'Trello request token exchange failed',
        code: 'TRELLO_REQUEST_TOKEN_FAILED',
        statusCode: response.status,
        details: {
          status: response.status,
          response: payloadText
        }
      })
    }

    const paramsResponse = new URLSearchParams(payloadText)
    const requestToken = paramsResponse.get('oauth_token')
    const requestTokenSecret = paramsResponse.get('oauth_token_secret')

    if (!requestToken || !requestTokenSecret) {
      throw new AppError({
        message: 'Trello request token response is invalid',
        code: 'TRELLO_REQUEST_TOKEN_INVALID',
        details: {
          response: payloadText
        }
      })
    }

    return { requestToken, requestTokenSecret }
  }

  public async getAccessToken(params: {
    oauthToken: string;
    oauthVerifier: string;
    requestTokenSecret: string;
  }): Promise<TrelloAccessTokenResult> {
    const authHeader = buildOAuthHeader({
      method: 'POST',
      url: ACCESS_TOKEN_URL,
      consumerKey: this.consumerKey,
      consumerSecret: this.consumerSecret,
      token: params.oauthToken,
      tokenSecret: params.requestTokenSecret,
      extraOAuthParams: {
        oauth_verifier: params.oauthVerifier
      }
    })

    const response = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader
      }
    })
    const payloadText = await response.text()
    if (!response.ok) {
      throw new AppError({
        message: 'Trello access token exchange failed',
        code: 'TRELLO_ACCESS_TOKEN_FAILED',
        statusCode: response.status,
        details: {
          status: response.status,
          response: payloadText
        }
      })
    }

    const accessParams = new URLSearchParams(payloadText)
    const accessToken = accessParams.get('oauth_token')

    if (!accessToken) {
      throw new AppError({
        message: 'Trello access token response is invalid',
        code: 'TRELLO_ACCESS_TOKEN_INVALID',
        details: {
          response: payloadText
        }
      })
    }

    return { accessToken }
  }

  public buildAuthorizeUrl(requestToken: string): string {
    const authorizeUrl = new URL(AUTHORIZE_TOKEN_URL)
    authorizeUrl.searchParams.set('oauth_token', requestToken)
    authorizeUrl.searchParams.set('name', 'Telegram Trello Bot')
    authorizeUrl.searchParams.set('scope', 'read,write')
    authorizeUrl.searchParams.set('expiration', 'never')

    return authorizeUrl.toString()
  }
}

export class TrelloMemberHttpGateway implements TrelloMemberGateway {
  public constructor(private readonly apiKey: string) {}

  public async getMemberProfile(accessToken: string): Promise<TrelloMemberProfile> {
    const response = await fetch(
      `${MEMBERS_ME_URL}?key=${encodeURIComponent(this.apiKey)}&token=${encodeURIComponent(accessToken)}&fields=id,username,prefs`
    )
    const payloadText = await response.text()
    let payload: unknown
    try {
      payload = JSON.parse(payloadText)
    } catch {
      payload = null
    }

    if (!response.ok || !isMemberPayload(payload)) {
      throw new AppError({
        message: 'Trello member profile fetch failed',
        code: 'TRELLO_MEMBER_FETCH_FAILED',
        statusCode: response.status,
        details: {
          status: response.status,
          response: payload ?? payloadText
        }
      })
    }

    return {
      ...payload,
      timeZone: extractTrelloTimeZone(payload)
    }
  }
}

function isMemberPayload(value: unknown): value is TrelloMemberProfile {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'username' in value &&
    typeof value.username === 'string'
  )
}

function extractTrelloTimeZone(member: { prefs?: unknown }): string | null {
  const prefs = member.prefs
  if (typeof prefs !== 'object' || prefs === null) {
    return null
  }

  if ('timezone' in prefs && typeof prefs.timezone === 'string') {
    return prefs.timezone
  }

  if ('timezoneInfo' in prefs && typeof prefs.timezoneInfo === 'object' && prefs.timezoneInfo !== null) {
    const timezoneInfo = prefs.timezoneInfo
    if ('timezone' in timezoneInfo && typeof timezoneInfo.timezone === 'string') {
      return timezoneInfo.timezone
    }
  }

  return null
}
