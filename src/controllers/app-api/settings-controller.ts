import type { AppPayload } from '#interfaces/app/app-payload.js'
import type { SettingsPayload } from '#interfaces/settings/settings-payload.js'
import type { TimeZoneOption } from '#interfaces/settings/time-zone-option.js'

import { env } from '../../config/env.js'
import { GetAppSettings } from '../../use-cases/settings/get-app-settings.js'
import { ListTimeZones } from '../../use-cases/settings/list-time-zones.js'
import { SaveUserSetting } from '../../use-cases/settings/save-user-setting.js'
import { TimeZoneSettingValidator } from '../../infrastructure/validation/time-zone-setting-validator.js'
import { USER_SETTING_KEYS } from '#interfaces/settings/user-setting-keys.js'
import type { UserSettingsRepositoryPort } from '../../interfaces/settings/user-settings-repository.js'
import type { TimeZoneProvider } from '../../interfaces/settings/time-zone-provider.js'
import type { TrelloController } from './trello-controller.js'

export type AppApiContext = {
  telegramUserId: number;
  telegramChatId: number;
};

export class SettingsController {
  private readonly getAppSettings: GetAppSettings
  private readonly listTimeZonesUseCase: ListTimeZones
  private readonly saveUserSetting: SaveUserSetting

  public constructor(
    userSettingsRepository: UserSettingsRepositoryPort,
    timeZoneProvider: TimeZoneProvider,
    private readonly trelloController: TrelloController
  ) {
    this.getAppSettings = new GetAppSettings(userSettingsRepository)
    this.listTimeZonesUseCase = new ListTimeZones(timeZoneProvider)
    this.saveUserSetting = new SaveUserSetting(new TimeZoneSettingValidator(timeZoneProvider), userSettingsRepository)
  }

  public listTimeZones(): TimeZoneOption[] {
    return this.listTimeZonesUseCase.call()
  }

  public async getSettings(telegramUserId: number): Promise<SettingsPayload> {
    return this.getAppSettings.call({
      telegramUserId,
      defaultTimeZone: env.APP_TIMEZONE
    })
  }

  public async saveTimeZone(params: { telegramUserId: number; timeZone: string }): Promise<SettingsPayload> {
    await this.saveUserSetting.call({ telegramUserId: params.telegramUserId, key: USER_SETTING_KEYS.TIME_ZONE, value: params.timeZone })
    return this.getSettings(params.telegramUserId)
  }

  public async getAppPayload(appContext: AppApiContext): Promise<AppPayload & { user: AppApiContext }> {
    return {
      user: {
        telegramUserId: appContext.telegramUserId,
        telegramChatId: appContext.telegramChatId
      },
      settings: await this.getSettings(appContext.telegramUserId),
      trello: await this.trelloController.getStatus(appContext.telegramUserId)
    }
  }
}
