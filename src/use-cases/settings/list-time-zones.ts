import type { TimeZoneOption } from '#interfaces/settings/time-zone-option.js'
import type { TimeZoneProvider } from '#interfaces/settings/time-zone-provider.js'
import type { UseCase } from '#interfaces/use-case.js'

export class ListTimeZones implements UseCase<void, TimeZoneOption[]> {
  public constructor(private readonly timeZoneProvider: TimeZoneProvider) {}

  public call(): TimeZoneOption[] {
    return this.timeZoneProvider.listTimeZoneOptions()
  }
}
