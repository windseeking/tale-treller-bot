import assert from 'node:assert/strict'
import test from 'node:test'

import appEn from '../../app/src/i18n/locales/en.json' with { type: 'json' }
import appRu from '../../app/src/i18n/locales/ru.json' with { type: 'json' }
import botEn from '../../src/i18n/locales/en.json' with { type: 'json' }
import botRu from '../../src/i18n/locales/ru.json' with { type: 'json' }
import { botMessages } from '../../src/i18n/index.ts'

test('bot locale catalogs have matching keys', () => {
  assert.deepEqual(listKeys(botRu), listKeys(botEn))
})

test('app locale catalogs have matching keys', () => {
  assert.deepEqual(listKeys(appRu), listKeys(appEn))
})

test('bot i18n-node helper interpolates named params', () => {
  assert.equal(
    botMessages('en').tooShort(7),
    'Still too little text: 7 characters. I need at least 15. Add more detail, then press *Create task* again.'
  )
  assert.equal(
    botMessages('ru').boardSelected('Inbox'),
    'Доска: *Inbox*'
  )
})

function listKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [prefix]
  }

  return Object.entries(value)
    .flatMap(([key, nextValue]) => listKeys(nextValue, prefix ? `${prefix}.${key}` : key))
    .sort()
}
