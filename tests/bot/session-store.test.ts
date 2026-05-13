import assert from 'node:assert/strict'
import test from 'node:test'

import { SessionStore } from '../../src/infrastructure/bot/session-store.ts'

test('SessionStore resetTask preserves generic last target while clearing current draft flow', () => {
  const sessions = new SessionStore()
  const session = sessions.get(100)

  session.messages = ['draft']
  session.draftText = 'draft'
  session.stage = 'destination_flow'
  session.destinationId = 'trello'
  session.selectionStep = 'trello:list'
  session.selectedTarget = { id: 'list-1', name: 'Doing' }
  session.lastTarget = { id: 'last-list', name: 'Last list' }
  session.destinationState = { boards: [{ id: 'board-1' }] }

  sessions.resetTask(100)

  assert.equal(session.stage, 'collecting')
  assert.deepEqual(session.messages, [])
  assert.equal(session.draftText, undefined)
  assert.equal(session.destinationId, undefined)
  assert.equal(session.selectedTarget, undefined)
  assert.deepEqual(session.destinationState, {})
  assert.deepEqual(session.lastTarget, { id: 'last-list', name: 'Last list' })
})

test('SessionStore clearSelectionFlow preserves draft messages and draft text', () => {
  const sessions = new SessionStore()
  const session = sessions.get(100)

  session.messages = ['first', 'second']
  session.draftText = 'first\n\nsecond'
  session.stage = 'destination_flow'
  session.destinationId = 'trello'
  session.selectionStep = 'trello:list'
  session.selectedTarget = { id: 'list-1', name: 'Doing' }
  session.destinationState = { lists: [{ id: 'list-1' }] }

  sessions.clearSelectionFlow(session)

  assert.equal(session.stage, 'collecting')
  assert.deepEqual(session.messages, ['first', 'second'])
  assert.equal(session.draftText, 'first\n\nsecond')
  assert.equal(session.destinationId, undefined)
  assert.equal(session.selectedTarget, undefined)
  assert.deepEqual(session.destinationState, {})
})

test('SessionStore completeTaskAndRememberSelection clears current task and stores last target', () => {
  const sessions = new SessionStore()
  const session = sessions.get(100)

  session.messages = ['draft']
  session.draftText = 'draft'
  session.stage = 'destination_flow'
  session.destinationId = 'trello'
  session.selectionStep = 'trello:list'
  session.selectedTarget = {
    id: 'list-1',
    name: 'Doing',
    data: { boardId: 'board-1', boardName: 'Roadmap', listId: 'list-1', listName: 'Doing' }
  }

  sessions.completeTaskAndRememberSelection(session)

  assert.equal(session.stage, 'collecting')
  assert.deepEqual(session.messages, [])
  assert.equal(session.draftText, undefined)
  assert.equal(session.destinationId, undefined)
  assert.equal(session.selectedTarget, undefined)
  assert.deepEqual(session.lastTarget, {
    id: 'list-1',
    name: 'Doing',
    data: { boardId: 'board-1', boardName: 'Roadmap', listId: 'list-1', listName: 'Doing' }
  })
  assert.equal(sessions.hasLastSelection(session), true)
})
