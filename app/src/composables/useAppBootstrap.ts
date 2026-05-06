import { ref } from 'vue'
import { DEFAULT_LOCALE } from '@shared/i18n'

import type { SettingsPayload, TimeZoneOption, TrelloPayload } from '../types/app'
import { appT, setAppLocale } from '../i18n'
import { useAppApi } from './api/useAppApi'
import { useTelegramApp } from './useTelegramApp'
import { getErrorMessage } from '../utils/errors'

function createDefaultSettings(): SettingsPayload {
  return {
    timeZone: null,
    isDefaultTimeZone: true,
    defaultTimeZone: 'UTC',
    locale: DEFAULT_LOCALE,
    defaultLocale: DEFAULT_LOCALE,
    localeOptions: [
      { value: 'en', label: 'English' },
      { value: 'ru', label: 'Русский' }
    ]
  }
}

function createDefaultTrello(): TrelloPayload {
  return {
    connected: false,
    username: null,
    expiresAt: null,
    expired: false
  }
}

export function useAppBootstrap() {
  const { initialize } = useTelegramApp()
  const { fetchMe, fetchTimeZones } = useAppApi()

  const settings = ref<SettingsPayload>(createDefaultSettings())
  const trello = ref<TrelloPayload>(createDefaultTrello())
  const timeZones = ref<TimeZoneOption[]>([])
  const fatalMessage = ref('')
  const isLoading = ref(true)

  async function load(): Promise<void> {
    isLoading.value = true

    try {
      const telegramResult = initialize()
      if (!telegramResult.ok) {
        fatalMessage.value = telegramResult.message ?? appT('openFromTelegram')
        return
      }

      const [appPayload, timeZonePayload] = await Promise.all([fetchMe(), fetchTimeZones()])
      settings.value = appPayload.settings
      setAppLocale(appPayload.settings.locale)
      trello.value = appPayload.trello
      timeZones.value = timeZonePayload.timeZones
    } catch (error) {
      fatalMessage.value = getErrorMessage(error)
    } finally {
      isLoading.value = false
    }
  }

  return {
    settings,
    trello,
    timeZones,
    fatalMessage,
    isLoading,
    load
  }
}
