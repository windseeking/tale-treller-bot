import type { TrelloPayload } from '../../types/app'
import { useApi } from './useApi'

export function useTrelloApi() {
  const { get, post } = useApi()

  const fetchStatus = async () => {
    return get<{ trello: TrelloPayload }>('/api/app/trello/status')
  }

  const createConnectLink = async () => {
    return post<{ url: string }>('/api/app/trello/connect-link')
  }

  const disconnect = async () => {
    return post<{ trello: TrelloPayload }>('/api/app/trello/disconnect')
  }

  return {
    fetchStatus,
    createConnectLink,
    disconnect
  }
}
