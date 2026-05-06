import { botButtons, type BotButtonLabelKey } from '../i18n/index.js'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../shared/i18n/index.js'

type BotActionConfig = {
  commands?: readonly string[];
  buttonLabelKeys?: readonly BotButtonLabelKey[];
};

const ACTION_CONFIG = {
  trello_connect: {
    commands: ['/trello_connect', '/connect_trello'],
    buttonLabelKeys: ['connectTrello']
  },
  trello_status: {
    commands: ['/trello_status'],
    buttonLabelKeys: ['statusTrello']
  },
  trello_disconnect: {
    commands: ['/trello_disconnect'],
    buttonLabelKeys: ['disconnectTrello']
  },
  create_task: {
    commands: ['/create_task'],
    buttonLabelKeys: ['createTask']
  },
  cancel: {
    commands: ['/cancel'],
    buttonLabelKeys: ['cancel']
  }
} as const satisfies Record<string, BotActionConfig>

export type BotActionId = keyof typeof ACTION_CONFIG;

const actionByCommand = new Map<string, BotActionId>()
const actionByLocaleLabel = new Map<SupportedLocale, Map<string, BotActionId>>()

for (const [actionId, config] of Object.entries(ACTION_CONFIG) as [BotActionId, BotActionConfig][]) {
  for (const trigger of config.commands ?? []) {
    actionByCommand.set(normalizeTrigger(trigger), actionId)
  }
}

for (const locale of SUPPORTED_LOCALES) {
  const labels = botButtons(locale)
  const actionByLabel = new Map<string, BotActionId>()

  for (const [actionId, config] of Object.entries(ACTION_CONFIG) as [BotActionId, BotActionConfig][]) {
    for (const labelKey of config.buttonLabelKeys ?? []) {
      actionByLabel.set(normalizeTrigger(labels[labelKey]), actionId)
    }
  }

  actionByLocaleLabel.set(locale, actionByLabel)
}

export function resolveBotAction(text: string, locale: SupportedLocale = DEFAULT_LOCALE): BotActionId | null {
  const trigger = normalizeTrigger(text)
  return actionByCommand.get(trigger) ?? actionByLocaleLabel.get(locale)?.get(trigger) ?? null
}

function normalizeTrigger(value: string): string {
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) {
    return trimmed
  }

  const [commandToken] = trimmed.split(/\s+/, 1)
  return commandToken.replace(/@[\w_]+$/, '')
}
