import type { AppPayload } from '#interfaces/app/app-payload'
import type { TimeZoneOption } from '#interfaces/settings/time-zone-option'
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
