import assert from 'node:assert/strict'
import test from 'node:test'

import { SettingsService } from '../../src/settings/settings-service.ts'

test('initial locale fill saves Telegram locale only when setting is missing', async () => {
  const values = new Map<string, string | null>()
  const saves: Array<{ telegramUserId: number; locale: string | null }> = []
  const service = new SettingsService({
    findTimeZone: async () => null,
    upsertTimeZone: async () => {},
    findLocale: async (telegramUserId: number) => values.get(String(telegramUserId)) ?? null,
    upsertLocale: async (params: { telegramUserId: number; locale: string | null }) => {
      saves.push(params)
      values.set(String(params.telegramUserId), params.locale)
    }
  } as never)

  assert.equal(await service.ensureInitialLocale({ telegramUserId: 1, languageCode: 'ru-RU' }), 'ru')
  assert.deepEqual(saves, [{ telegramUserId: 1, locale: 'ru' }])

  assert.equal(await service.ensureInitialLocale({ telegramUserId: 1, languageCode: 'en-US' }), 'ru')
  assert.deepEqual(saves, [{ telegramUserId: 1, locale: 'ru' }])
})
