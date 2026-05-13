import type { TimeZoneOption } from './time-zone-option.js'

export interface TimeZoneProvider {
  isValidTimeZone(value: string): boolean;
  listTimeZoneOptions(now?: Date): TimeZoneOption[];
  getCurrentDateWithOffset(timeZone: string, now?: Date): string;
}
