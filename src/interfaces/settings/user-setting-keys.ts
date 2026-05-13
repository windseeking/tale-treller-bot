export const USER_SETTING_KEYS = {
  TIME_ZONE: 'time_zone'
} as const

export type UserSettingKey = typeof USER_SETTING_KEYS[keyof typeof USER_SETTING_KEYS]
