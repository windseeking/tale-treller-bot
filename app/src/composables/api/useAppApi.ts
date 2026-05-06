import type { AppPayload, TimeZoneOption } from '../../types/app'
import { useApi } from './useApi'

export function useAppApi() {
  const { get } = useApi()

  const fetchMe = async () => {
    return get<AppPayload>('/api/app/me')
  }

  const fetchTimeZones = async () => {
    return get<{ timeZones: TimeZoneOption[] }>('/api/app/time-zones')
  }

  return {
    fetchMe,
    fetchTimeZones
  }
}
