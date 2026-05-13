import assert from 'node:assert/strict'
import test from 'node:test'

import type { TaskDestinationHandler } from '../../src/interfaces/bot.ts'
import { InMemoryTaskDestinationRegistry } from '../../src/controllers/bot/task-destination-registry.ts'
import { DefaultTaskContentGeneratorResolver } from '../../src/infrastructure/llm/default-task-content-generator-resolver.ts'

test('TaskDestinationRegistry resolves Trello commands and callbacks by namespace', () => {
  const trello = fakeDestination('trello')
  const registry = new InMemoryTaskDestinationRegistry([trello], 'trello')

  assert.equal(registry.getDefault(), trello)
  assert.equal(registry.findByAction('trello:connect'), trello)
  assert.equal(registry.findByCallbackData('trello:board:board-1'), trello)
  assert.equal(registry.findByCallbackData('linear:issue:issue-1'), null)
})

test('DefaultTaskContentGeneratorResolver returns the configured default generator', async () => {
  const generator = {
    async generateTask() {
      return { name: 'Generated', desc: 'Generated description' }
    }
  }
  const resolver = new DefaultTaskContentGeneratorResolver(generator)

  assert.equal(
    await resolver.resolve({ telegramUserId: 42, destinationId: 'trello' }),
    generator
  )
})

function fakeDestination(id: string): TaskDestinationHandler {
  return {
    id,
    ownsAction(action) {
      return action.startsWith(`${id}:`)
    },
    ownsCallbackData(data) {
      return data.startsWith(`${id}:`)
    },
    async getWelcomeResponse() {
      return { text: 'welcome', replyMarkup: {} }
    },
    async getMainReplyKeyboard() {
      return {}
    },
    async handleAction() {},
    async handleCallback() {},
    async handleTextDuringFlow() {},
    async beginTaskCreation() {}
  }
}
