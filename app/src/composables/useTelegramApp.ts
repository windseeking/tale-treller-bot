import { readonly, ref } from 'vue'
import { appT } from '../i18n'

const telegramInitData = ref('')

export function useTelegramApp() {
  function initialize(): { ok: true } | { ok: false; message: string } {
    window.Telegram?.WebApp?.ready()
    window.Telegram?.WebApp?.expand()
    window.Telegram?.WebApp?.MainButton?.hide()

    telegramInitData.value = window.Telegram?.WebApp?.initData ?? ''

    if (!telegramInitData.value) {
      return { ok: false, message: appT('openFromTelegram') }
    }

    return { ok: true }
  }

  return {
    initialize,
    telegramInitData: readonly(telegramInitData)
  }
}
