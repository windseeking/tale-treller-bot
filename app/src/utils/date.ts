import type { SupportedLocale } from '@shared/i18n'

export function formatDateTime(value: string, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}
