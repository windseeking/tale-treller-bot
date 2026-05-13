import type { SettingsPayload } from '#interfaces/settings/settings-payload.js'
import type { UserSettingsRepositoryPort } from '#interfaces/settings/user-settings-repository.js'
import type { UseCase } from '#interfaces/use-case.js'
import { USER_SETTING_KEYS } from '#interfaces/settings/user-setting-keys.js'

export type GetAppSettingsInput = {
  telegramUserId: number;
  defaultTimeZone: string;
};

export class GetAppSettings implements UseCase<GetAppSettingsInput, Promise<SettingsPayload>> {
  public constructor(private readonly userSettingsRepository: UserSettingsRepositoryPort) {}

  public async call(input: GetAppSettingsInput): Promise<SettingsPayload> {
    const timeZone = await this.userSettingsRepository.findValue(input.telegramUserId, USER_SETTING_KEYS.TIME_ZONE)

    return {
      timeZone,
      isDefaultTimeZone: !timeZone,
      defaultTimeZone: input.defaultTimeZone
    }
  }
}
