import { useTelegramApp } from '../useTelegramApp'

type ApiOptions = Omit<RequestInit, 'body' | 'method'> & {
  body?: unknown;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
};

type ApiEnvelope = {
  ok?: boolean;
  message?: string;
};

export function useApi() {
  const { telegramInitData } = useTelegramApp()

  async function request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers, ...restOptions } = options
    const requestHeaders = new Headers(headers)
    requestHeaders.set('Content-Type', 'application/json')

    if (telegramInitData.value) {
      requestHeaders.set('X-Telegram-Init-Data', telegramInitData.value)
    }

    const response = await fetch(endpoint, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: requestHeaders,
      ...restOptions
    })
    const payload = (await response.json()) as ApiEnvelope & T

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || 'Запрос не выполнен.')
    }

    return payload
  }

  return {
    get: <T>(endpoint: string, options?: Omit<ApiOptions, 'body' | 'method'>) =>
      request<T>(endpoint, { method: 'GET', ...options }),
    post: <T>(endpoint: string, body?: unknown, options?: Omit<ApiOptions, 'body' | 'method'>) =>
      request<T>(endpoint, { method: 'POST', body, ...options }),
    put: <T>(endpoint: string, body?: unknown, options?: Omit<ApiOptions, 'body' | 'method'>) =>
      request<T>(endpoint, { method: 'PUT', body, ...options }),
    patch: <T>(endpoint: string, body?: unknown, options?: Omit<ApiOptions, 'body' | 'method'>) =>
      request<T>(endpoint, { method: 'PATCH', body, ...options }),
    del: <T>(endpoint: string, options?: Omit<ApiOptions, 'body' | 'method'>) =>
      request<T>(endpoint, { method: 'DELETE', ...options })
  }
}
