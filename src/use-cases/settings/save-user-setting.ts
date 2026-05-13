import type {UserSettingsRepositoryPort} from '#interfaces/settings/user-settings-repository.js'
import type {UseCase} from '#interfaces/use-case.js'
import type {Validator} from '#interfaces/validator.js'
import type {UserSettingKey} from '#interfaces/settings/user-setting-keys.js'
import {ValidationError} from '#errors/validation-error.js'

export type SaveUserSettingInput = {
    telegramUserId: number;
    key: UserSettingKey;
    value: string;
}

export class SaveUserSetting implements UseCase<SaveUserSettingInput, Promise<void>> {
    public constructor(
        private readonly validator: Validator<SaveUserSettingInput>,
        private readonly userSettingsRepository: UserSettingsRepositoryPort
    ) {
    }

    public async call(input: SaveUserSettingInput): Promise<void> {
        const {data, errors} = this.validator.validate(input)

        if (errors.length > 0) {
            throw new ValidationError({
                message: `Invalid value for setting "${input.key}"`,
                code: 'USER_SETTING_VALIDATION_ERROR',
                details: errors
            })
        }

        await this.userSettingsRepository.upsertValue({
            telegramUserId: data.telegramUserId,
            key: data.key,
            value: data.value
        })
    }
}
