export const BOT_BUTTON_LABELS = {
    connectTrello: 'Подключить Trello',
    statusTrello: 'Статус Trello',
    disconnectTrello: 'Выйти из Trello',
    createTask: 'Создать задачу',
    cancel: 'Отмена',
    inlineCancel: '❌ Отмена',
    changeBoard: '↩️ Поменять доску',
    useLastSelection: 'Создать тут',
    openCard: 'Открыть карточку'
} as const

export type BotActionConfig = {
    commands: readonly string[];
    buttonLabels: readonly string[];
};

export const ACTION_CONFIG = {
    'trello:connect': {
        commands: ['/trello_connect', '/connect_trello'],
        buttonLabels: [BOT_BUTTON_LABELS.connectTrello]
    },
    'trello:status': {
        commands: ['/trello_status'],
        buttonLabels: [BOT_BUTTON_LABELS.statusTrello]
    },
    'trello:disconnect': {
        commands: ['/trello_disconnect'],
        buttonLabels: [BOT_BUTTON_LABELS.disconnectTrello]
    },
    'task:create': {
        commands: ['/create_task'],
        buttonLabels: [BOT_BUTTON_LABELS.createTask]
    },
    'task:cancel': {
        commands: ['/cancel'],
        buttonLabels: [BOT_BUTTON_LABELS.cancel]
    }
} as const satisfies Record<string, BotActionConfig>

export type BotAction = keyof typeof ACTION_CONFIG;

export type BotSentMessage = {
    messageId: number;
};

export type BotMessageOptions = {
    reply_markup?: unknown;
};

export interface BotMessenger {
    replyMarkdown(text: string, options?: BotMessageOptions): Promise<BotSentMessage>;
    answerCallbackQuery(): Promise<void>;
    replaceCallbackMessageText(text: string, options?: BotMessageOptions): Promise<void>;
    replaceBotMessageText(messageId: number, text: string, options?: BotMessageOptions): Promise<void>;
    tryDeleteIncomingMessage(): Promise<void>;
    hideMainReplyKeyboard(): Promise<void>;
}

export type BotIdentity = {
    chatId: number;
    telegramUserId: number;
};

export type BotRequest = {
    identity: BotIdentity;
    messenger: BotMessenger;
    action?: BotAction | null;
    body?: {
        text?: string;
    };
    callbackData?: string;
    params?: Record<string, string | number | boolean | undefined>;
};

export type BotStage = 'collecting' | 'destination_flow';

export type DestinationTarget = {
    id: string;
    name: string;
    data?: Record<string, unknown>;
};

export type BotSessionState = {
    stage: BotStage;
    messages: string[];
    draftText?: string;
    destinationId?: string;
    selectionStep?: string;
    selectedTarget?: DestinationTarget;
    lastTarget?: DestinationTarget;
    destinationState: Record<string, unknown>;
};

export type BotReplyKeyboardContext = {
    identity: BotIdentity;
};

export type BotWelcomeResponse = {
    text: string;
    replyMarkup: unknown;
};

export interface TaskDestinationHandler {
    readonly id: string;
    ownsAction(action: BotAction): boolean;
    ownsCallbackData(data: string): boolean;
    getWelcomeResponse(context: BotReplyKeyboardContext): Promise<BotWelcomeResponse>;
    getMainReplyKeyboard(context: BotReplyKeyboardContext): Promise<unknown>;
    handleAction(request: BotRequest, session: BotSessionState): Promise<void>;
    handleCallback(request: BotRequest, session: BotSessionState): Promise<void>;
    handleTextDuringFlow(request: BotRequest, session: BotSessionState): Promise<void>;
    beginTaskCreation(request: BotRequest, session: BotSessionState): Promise<void>;
}

export interface SessionStorePort {
  get(chatId: number): BotSessionState;
  resetTask(chatId: number): BotSessionState;
  hasLastSelection(session: BotSessionState): boolean;
  clearSelectionFlow(session: BotSessionState): void;
  startDestinationFlow(session: BotSessionState, params: {
    destinationId: string;
    selectionStep?: string;
    state?: Record<string, unknown>;
  }): void;
  setSelectionStep(session: BotSessionState, selectionStep: string): void;
  setSelectedTarget(session: BotSessionState, target: DestinationTarget): void;
  useLastSelection(session: BotSessionState): void;
  completeTaskAndRememberSelection(session: BotSessionState): void;
}

export interface TaskDestinationRegistry {
    getDefault(): TaskDestinationHandler;
    findById(destinationId: string): TaskDestinationHandler | null;
    findByAction(action: BotAction): TaskDestinationHandler | null;
    findByCallbackData(data: string): TaskDestinationHandler | null;
}
