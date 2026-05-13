import type {TimeZoneProvider} from '#interfaces/settings/time-zone-provider.js'
import type {SaveUserSettingInput} from '#usecases/settings/save-user-setting.js'
import type {ValidationResult, Validator} from '#interfaces/validator.js'

export class TimeZoneSettingValidator implements Validator<SaveUserSettingInput> {
    public constructor(private readonly timeZoneProvider: TimeZoneProvider) {
    }

    public validate(data: Partial<SaveUserSettingInput>): ValidationResult<SaveUserSettingInput> {
        if (!data.value || !this.timeZoneProvider.isValidTimeZone(data.value)) {
            return {
                data: data as SaveUserSettingInput,
                errors: [{
                    field: 'value',
                    message: `Invalid IANA timezone: ${data.value}`
                }]
            }
        }

        return {data: data as SaveUserSettingInput, errors: []}
    }
}
