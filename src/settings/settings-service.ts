import { UserSettingsRepository } from '../db/repositories/user-settings-repository.js'
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  resolveSupportedLocale,
  type SupportedLocale
} from '../shared/i18n/index.js'
import { isValidTimeZone } from './time-zone.js'

export class SettingsService {
  public constructor(private readonly userSettingsRepository: UserSettingsRepository) {}

  public async findTimeZone(telegramUserId: number): Promise<string | null> {
    return this.userSettingsRepository.findTimeZone(telegramUserId)
  }

  public async saveTimeZone(params: { telegramUserId: number; timeZone: string }): Promise<void> {
    if (!isValidTimeZone(params.timeZone)) {
      throw new Error(`Invalid time zone: ${params.timeZone}`)
    }

    await this.userSettingsRepository.upsertTimeZone({
      telegramUserId: params.telegramUserId,
      timeZone: params.timeZone
    })
  }

  public async findLocale(telegramUserId: number): Promise<SupportedLocale | null> {
    const locale = await this.userSettingsRepository.findLocale(telegramUserId)
    return isSupportedLocale(locale) ? locale : null
  }

  public async resolveLocale(telegramUserId: number): Promise<SupportedLocale> {
    return (await this.findLocale(telegramUserId)) ?? DEFAULT_LOCALE
  }

  public async saveLocale(params: { telegramUserId: number; locale: string }): Promise<void> {
    if (!isSupportedLocale(params.locale)) {
      throw new Error(`Invalid locale: ${params.locale}`)
    }

    await this.userSettingsRepository.upsertLocale({
      telegramUserId: params.telegramUserId,
      locale: params.locale
    })
  }

  public async ensureInitialLocale(params: {
    telegramUserId: number;
    languageCode?: string | null;
  }): Promise<SupportedLocale> {
    const existingLocale = await this.findLocale(params.telegramUserId)
    if (existingLocale) {
      return existingLocale
    }

    const locale = resolveSupportedLocale(params.languageCode)
    await this.userSettingsRepository.upsertLocale({
      telegramUserId: params.telegramUserId,
      locale
    })
    return locale
  }
}
