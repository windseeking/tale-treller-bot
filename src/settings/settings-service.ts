import { UserSettingsRepository } from '../db/repositories/user-settings-repository.js'
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
}
