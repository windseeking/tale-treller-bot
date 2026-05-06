export const SUPPORTED_LOCALES = ['en', 'ru'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en'
export const LOCALE_SETTING_KEY = 'locale'

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function resolveSupportedLocale(languageCode?: string | null): SupportedLocale {
  if (!languageCode) {
    return DEFAULT_LOCALE
  }

  const normalized = languageCode.toLowerCase().replace('_', '-')
  const base = normalized.split('-')[0]

  if (isSupportedLocale(normalized)) {
    return normalized
  }

  if (isSupportedLocale(base)) {
    return base
  }

  return DEFAULT_LOCALE
}
