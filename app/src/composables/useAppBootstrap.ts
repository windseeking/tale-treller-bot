import { ref } from 'vue'

import type { SettingsPayload, TimeZoneOption, TrelloPayload } from '../types/app'
import { useAppApi } from './api/useAppApi'
import { useTelegramApp } from './useTelegramApp'
import { getErrorMessage } from '../utils/errors'

function createDefaultSettings(): SettingsPayload {
  return {
    timeZone: null,
    isDefaultTimeZone: true,
    defaultTimeZone: 'UTC'
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
        fatalMessage.value = telegramResult.message ?? 'Откройте приложение из Telegram.'
        return
      }

      const [appPayload, timeZonePayload] = await Promise.all([fetchMe(), fetchTimeZones()])
      settings.value = appPayload.settings
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
