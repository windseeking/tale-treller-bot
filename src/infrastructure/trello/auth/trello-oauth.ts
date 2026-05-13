import { createHmac, randomBytes } from 'node:crypto'

function encodeRfc3986(input: string): string {
  return encodeURIComponent(input)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function buildParameterString(params: Record<string, string>): string {
  return Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&')
}

function buildSignatureBaseString(params: {
  method: string;
  url: string;
  allParams: Record<string, string>;
}): string {
  return [
    params.method.toUpperCase(),
    encodeRfc3986(params.url),
    encodeRfc3986(buildParameterString(params.allParams))
  ].join('&')
}

function buildSigningKey(params: { consumerSecret: string; tokenSecret?: string }): string {
  return `${encodeRfc3986(params.consumerSecret)}&${encodeRfc3986(params.tokenSecret ?? '')}`
}

function sign(params: {
  method: string;
  url: string;
  allParams: Record<string, string>;
  consumerSecret: string;
  tokenSecret?: string;
}): string {
  const baseString = buildSignatureBaseString({
    method: params.method,
    url: params.url,
    allParams: params.allParams
  })
  const key = buildSigningKey({
    consumerSecret: params.consumerSecret,
    tokenSecret: params.tokenSecret
  })

  return createHmac('sha1', key).update(baseString).digest('base64')
}

function buildNonce(): string {
  return randomBytes(16).toString('hex')
}

export function buildOAuthHeader(params: {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
  extraOAuthParams?: Record<string, string>;
  queryParams?: Record<string, string>;
}): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: params.consumerKey,
    oauth_nonce: buildNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    ...(params.token ? { oauth_token: params.token } : {}),
    ...(params.extraOAuthParams ?? {})
  }

  const allParams: Record<string, string> = {
    ...oauthParams,
    ...(params.queryParams ?? {})
  }

  oauthParams.oauth_signature = sign({
    method: params.method,
    url: params.url,
    allParams,
    consumerSecret: params.consumerSecret,
    tokenSecret: params.tokenSecret
  })

  const parts = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeRfc3986(key)}="${encodeRfc3986(value)}"`)

  return `OAuth ${parts.join(', ')}`
}
