import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_LOCALE,
  resolveSupportedLocale
} from '../../src/shared/i18n/index.ts'
import { resolveBotAction } from '../../src/bot/actions.ts'
import { botButtons } from '../../src/i18n/index.ts'

test('resolves slash commands independently of reply keyboard labels', () => {
  assert.equal(resolveBotAction('/create_task'), 'create_task')
  assert.equal(resolveBotAction('/create_task@taletrellerbot extra text'), 'create_task')
  assert.equal(resolveBotAction('/trello_status'), 'trello_status')
})

test('resolves reply keyboard labels through the provided locale', () => {
  const ruLabels = botButtons('ru')
  const enLabels = botButtons('en')

  assert.equal(resolveBotAction(ruLabels.createTask, 'ru'), 'create_task')
  assert.equal(resolveBotAction(ruLabels.cancel, 'ru'), 'cancel')
  assert.equal(resolveBotAction(ruLabels.connectTrello, 'ru'), 'trello_connect')
  assert.equal(resolveBotAction(ruLabels.disconnectTrello, 'ru'), 'trello_disconnect')
  assert.equal(resolveBotAction(enLabels.createTask, 'en'), 'create_task')
  assert.equal(resolveBotAction(enLabels.cancel, 'en'), 'cancel')
  assert.equal(resolveBotAction(enLabels.connectTrello, 'en'), 'trello_connect')
  assert.equal(resolveBotAction(enLabels.disconnectTrello, 'en'), 'trello_disconnect')
})

test('resolves Telegram language codes to supported locales', () => {
  assert.equal(resolveSupportedLocale('ru-RU'), 'ru')
  assert.equal(resolveSupportedLocale('ru_RU'), 'ru')
  assert.equal(resolveSupportedLocale('en-US'), 'en')
  assert.equal(resolveSupportedLocale(null), DEFAULT_LOCALE)
})
