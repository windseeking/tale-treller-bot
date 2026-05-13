import { useApi } from './useApi'
import type { TrelloConnection } from '#interfaces/trello/auth/connections-repository'

export function useTrelloApi() {
  const { get, post } = useApi()

  const fetchStatus = async () => {
    return get<{ trello: TrelloConnection }>('/api/app/trello/status')
  }

  const createConnectLink = async () => {
    return post<{ url: string }>('/api/app/trello/connect-link')
  }

  const disconnect = async () => {
    return post<{ trello: TrelloConnection }>('/api/app/trello/disconnect')
  }

  return {
    fetchStatus,
    createConnectLink,
    disconnect
  }
}
