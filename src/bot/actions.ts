export const BOT_BUTTON_LABELS = {
  connectTrello: "Подключить Trello",
  statusTrello: "Статус Trello",
  disconnectTrello: "Выйти из Trello",
  settings: "Настройки",
  createTask: "Создать задачу",
  cancel: "Отмена",
  inlineCancel: "❌ Отмена",
  changeBoard: "↩️ Поменять доску",
  useLastSelection: "Создать тут",
  openCard: "Открыть карточку"
} as const;

type BotActionConfig = {
  commands?: readonly string[];
  buttonLabels?: readonly string[];
};

const ACTION_CONFIG = {
  trello_connect: {
    commands: ["/trello_connect", "/connect_trello"],
    buttonLabels: [BOT_BUTTON_LABELS.connectTrello]
  },
  trello_status: {
    commands: ["/trello_status"],
    buttonLabels: [BOT_BUTTON_LABELS.statusTrello]
  },
  trello_disconnect: {
    commands: ["/trello_disconnect"],
    buttonLabels: [BOT_BUTTON_LABELS.disconnectTrello]
  },
  settings: {
    commands: ["/settings"],
    buttonLabels: [BOT_BUTTON_LABELS.settings]
  },
  create_task: {
    commands: ["/create_task"],
    buttonLabels: [BOT_BUTTON_LABELS.createTask]
  },
  cancel: {
    commands: ["/cancel"],
    buttonLabels: [BOT_BUTTON_LABELS.cancel]
  }
} as const satisfies Record<string, BotActionConfig>;

export type BotActionId = keyof typeof ACTION_CONFIG;

const actionByTrigger = new Map<string, BotActionId>();

for (const [actionId, config] of Object.entries(ACTION_CONFIG) as [BotActionId, BotActionConfig][]) {
  for (const trigger of config.commands ?? []) {
    actionByTrigger.set(normalizeTrigger(trigger), actionId);
  }
  for (const trigger of config.buttonLabels ?? []) {
    actionByTrigger.set(normalizeTrigger(trigger), actionId);
  }
}

export function resolveBotAction(text: string): BotActionId | null {
  return actionByTrigger.get(normalizeTrigger(text)) ?? null;
}

function normalizeTrigger(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return trimmed;
  }

  const [commandToken] = trimmed.split(/\s+/, 1);
  return commandToken.replace(/@[\w_]+$/, "");
}
