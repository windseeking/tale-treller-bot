import { KNOWN_TIME_ZONE_NAMES } from './time-zone-constants.js'

export const TIME_ZONE_SETTING_KEY = 'time_zone'

export type TimeZoneOption = {
  name: string;
  offset: string;
};

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function listTimeZoneOptions(now = new Date()): TimeZoneOption[] {
  return KNOWN_TIME_ZONE_NAMES
    .filter(isValidTimeZone)
    .map((name) => ({
      name,
      offset: getTimeZoneOffset(name, now)
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))
}

export function getCurrentDateWithOffset(timeZone: string, now = new Date()): string {
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`Invalid time zone: ${timeZone}`)
  }

  const parts = getDateTimeParts(timeZone, now)
  const offset = getOffsetForDateTime(parts, now)

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${parts.fractionalSecond}${offset}`
}

function getTimeZoneOffset(timeZone: string, now = new Date()): string {
  const parts = getDateTimeParts(timeZone, now)
  return getOffsetForDateTime(parts, now)
}

type DateTimeParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  fractionalSecond: string;
};

function getDateTimeParts(timeZone: string, date: Date): DateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hourCycle: 'h23'
  })

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  )

  return {
    year: requireDateTimePart(parts, 'year'),
    month: requireDateTimePart(parts, 'month'),
    day: requireDateTimePart(parts, 'day'),
    hour: requireDateTimePart(parts, 'hour'),
    minute: requireDateTimePart(parts, 'minute'),
    second: requireDateTimePart(parts, 'second'),
    fractionalSecond: requireDateTimePart(parts, 'fractionalSecond')
  }
}

function requireDateTimePart(parts: Record<string, string>, key: keyof DateTimeParts): string {
  const value = parts[key]
  if (!value) {
    throw new Error(`Intl.DateTimeFormat did not return ${key}`)
  }

  return value
}

function getOffsetForDateTime(parts: DateTimeParts, date: Date): string {
  const localAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
    Number(parts.fractionalSecond)
  )
  const offsetMinutes = Math.round((localAsUtc - date.getTime()) / 60_000)

  return formatOffsetMinutes(offsetMinutes)
}

function formatOffsetMinutes(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+'
  const absolute = Math.abs(offsetMinutes)
  const hours = Math.floor(absolute / 60)
  const minutes = absolute % 60

  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
