import type {CreateTrelloCardInput} from '../trello/types.js'

const MIN_TEXT_LENGTH = 15

export function validateTaskTextLength(messages: string[]): { ok: boolean; currentLength: number } {
  const text = collectTaskText(messages)
  return { ok: text.length >= MIN_TEXT_LENGTH, currentLength: text.length }
}

export function collectTaskText(messages: string[]): string {
  return messages
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n\n')
}

export function buildCardInput(params: { messages: string[]; idList: string }): CreateTrelloCardInput {
  const text = collectTaskText(params.messages)

  return {
    name: buildCardName(text),
    desc: buildCardDescription(text),
    idList: params.idList,
    pos: 'top',
    urlSource: findFirstUrl(text)
  }
}

function buildCardName(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()

  if (!collapsed) {
    return 'Новая задача'
  }

  const firstSentence = collapsed.split(/[.!?]/)[0]?.trim() ?? ''
  const source = firstSentence.length > 0 ? firstSentence : collapsed
  const maxLength = 80

  return source.length <= maxLength ? source : `${source.slice(0, maxLength - 1)}…`
}

function buildCardDescription(text: string): string {
  return [
    '## Описание задачи',
    text,
    '',
    '## Исходные сообщения',
    text
      .split('\n\n')
      .map((line) => `- ${line}`)
      .join('\n')
  ].join('\n')
}

function findFirstUrl(text: string): string | undefined {
  return text.match(/https?:\/\/[^\s)]+/i)?.[0]
}
