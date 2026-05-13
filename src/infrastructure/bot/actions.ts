import {ACTION_CONFIG, type BotAction, type BotActionConfig} from '#interfaces/bot.js'

const actionByTrigger = new Map<string, BotAction>()

for (const [actionId, config] of Object.entries(ACTION_CONFIG) as [BotAction, BotActionConfig][]) {
  for (const trigger of config.commands ?? []) {
    actionByTrigger.set(normalizeTrigger(trigger), actionId)
  }
  for (const trigger of config.buttonLabels ?? []) {
    actionByTrigger.set(normalizeTrigger(trigger), actionId)
  }
}

export function resolveBotAction(text: string): BotAction | null {
  return actionByTrigger.get(normalizeTrigger(text)) ?? null
}

function normalizeTrigger(value: string): string {
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) {
    return trimmed
  }

  const [commandToken] = trimmed.split(/\s+/, 1)
  return commandToken.replace(/@[\w_]+$/, '')
}
