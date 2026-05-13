import type { TimeZoneValidator } from '#interfaces/settings/time-zone-validator.js'
import isValidTimezone from '../utils/isValidTimezone.js'

export class IntlTimeZoneValidator implements TimeZoneValidator {
  public isValid(timeZone: string): boolean {
    return isValidTimezone(timeZone)
  }
}
