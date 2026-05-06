import type { SupportedLocale } from '@shared/i18n'

export type LocaleOption = {
  value: SupportedLocale;
  label: string;
};

export type TimeZoneOption = {
  name: string;
  offset: string;
};

export type SettingsPayload = {
  timeZone: string | null;
  isDefaultTimeZone: boolean;
  defaultTimeZone: string;
  locale: SupportedLocale;
  defaultLocale: SupportedLocale;
  localeOptions: LocaleOption[];
};

export type TrelloPayload = {
  connected: boolean;
  username: string | null;
  expiresAt: string | null;
  expired: boolean;
};

export type AppPayload = {
  settings: SettingsPayload;
  trello: TrelloPayload;
};
