import type { SettingsPayload } from '../../types/app'
import { useApi } from './useApi'

export function useSettingsApi() {
  const { patch } = useApi()

  const saveTimeZone = async (timeZone: string) => {
    return patch<{ settings: SettingsPayload }>('/api/app/settings', { timeZone })
  }

  return {
    saveTimeZone
  }
}
