import { createI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, type SupportedLocale } from '@shared/i18n'
import en from './locales/en.json'
import ru from './locales/ru.json'

export const appI18n = createI18n({
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    en,
    ru
  }
})

export function setAppLocale(locale: SupportedLocale): void {
  appI18n.global.locale.value = locale
}

export function appT(key: string, params?: Record<string, unknown>): string {
  return appI18n.global.t(key, params ?? {})
}
