import type { SupportedLocale } from '@shared/i18n'
import type { SettingsPayload } from '../../types/app'
import { useApi } from './useApi'

export function useSettingsApi() {
  const { patch } = useApi()

  const saveTimeZone = async (timeZone: string) => {
    return patch<{ settings: SettingsPayload }>('/api/app/settings', { timeZone })
  }

  const saveLocale = async (locale: SupportedLocale) => {
    return patch<{ settings: SettingsPayload }>('/api/app/settings', { locale })
  }

  return {
    saveTimeZone,
    saveLocale
  }
}
