import { BOT_BUTTON_LABELS } from './actions.js'

export const BOT_MESSAGES = {
  welcomeAuthorized:
    `Привет! Я готов помочь с постановкой задач в Trello ✨\n\nПришли одно или несколько текстовых сообщений, а когда будешь готов — нажми кнопку *${BOT_BUTTON_LABELS.createTask}*.`,
  welcomeUnauthorized:
    'Привет! Я готов помочь с постановкой задач в Trello ✨\n\nЧтобы создавать задачи, сначала подключи Trello.',
  tooShort: (length: number) =>
    `Пока маловато текста: ${length} символов. Нужно минимум 15. Добавь деталей и снова нажми *${BOT_BUTTON_LABELS.createTask}*.`,
  draftEmpty:
    `Пока не вижу текста задачи. Пришли сообщения с деталями, затем нажми *${BOT_BUTTON_LABELS.createTask}*.`,
  pickBoard: 'Отлично, теперь выбери доску, где создать карточку:',
  noBoards: 'Не нашел доступные доски для этого пользователя Trello 🕵',
  reuseSelection: (boardName: string, listName: string) =>
    `Доска: *${boardName}*\nКолонка: *${listName}*\n\nСоздать карточку тут?`,
  pickList: 'Теперь выбери список:',
  boardSelected: (boardName: string) => `Доска: *${boardName}*`,
  listSelected: (listName: string) => `Колонка: *${listName}*`,
  noLists: 'В этой доске пока нет доступных колонок 😕 Давай выберем другую доску.',
  canceled:
    'Ок, задачу отменил ✋ Текущий черновик сброшен, можешь присылать новые сообщения для следующей задачи.',
  boardChanged: 'Хорошо, давай выберем другую доску 🔄',
  waitLastSelection: 'Выбери один из вариантов ниже 👇',
  waitBoard: 'Сначала выбери доску из кнопок ниже 👇',
  waitList: 'Сначала выбери колонку из кнопок ниже 👇',
  cardCreated: (cardName: string, cardShortUrl: string) =>
    `Готово! 🎉 Карточка *${cardName}* создана.\nСсылка: ${cardShortUrl}`,
  cardInProgress: 'Принято! Собираю карточку и отправляю в Trello ⏳',
  readyForNextDraft: `Готов к новой задаче ✍️ Пришли сообщения и нажми *${BOT_BUTTON_LABELS.createTask}*.`,
  genericError: 'Ой, что-то пошло не так 😔 Попробуй еще раз.',
  unsupportedMessage: 'Пока поддерживаются только текстовые сообщения 💬',
  authRequired:
    'Чтобы продолжить, нужно подключить Trello. Это требуется один раз в 30 дней.',
  authLinkCreated:
    'Открой ссылку и подтверди доступ к Trello. После этого вернись в Telegram и продолжай с того же черновика.',
  authDisconnected: 'Аккаунт Trello отвязан. Для создания задач подключи Trello заново.',
  authStatusConnected: (username: string, expiresAt: string) =>
    `Trello подключен ✅\nПользователь: *${username}*\nДействует до: *${expiresAt}*`,
  authStatusExpired: (username: string, expiresAt: string) =>
    `Подключение Trello истекло ⚠️\nПользователь: *${username}*\nИстекло: *${expiresAt}*\nНужно переподключить аккаунт.`,
  authStatusNotConnected: `Trello не подключен. Нажми *${BOT_BUTTON_LABELS.connectTrello}*, чтобы продолжить.`,
  authFlowInterrupted:
    'Текущая сессия Trello недоступна. Переподключи аккаунт, черновик сохранен.',
  authServiceSessionNotFound: 'Сессия авторизации не найдена.',
  authServiceSessionAlreadyUsed:
    'Ссылка уже использована. Вернитесь в Telegram и запустите подключение Trello ещё раз.',
  authServiceSessionExpired: 'Сессия авторизации истекла. Запустите подключение снова.',
  authServiceSessionSecretInvalid: 'Неверный секрет сессии.',
  authServiceSessionStatusInvalid: 'Некорректный статус сессии. Запустите подключение заново.',
  authServiceUserDenied: 'Вы отменили подключение Trello.',
  authServiceMissingCallbackParams: 'Callback Trello не содержит обязательные параметры.',
  authServiceTokenMismatch: 'Токен сессии не совпадает. Запустите подключение заново.',
  authServiceConnected: 'Trello подключен. Можно возвращаться в Telegram.',
  authServiceConnectedNotification: 'Trello подключен, можно создавать задачу ✅',
  timeZoneSetupIntro:
    'Чтобы я корректно понимал сроки задач, укажи часовой пояс в приложении настроек. Можно пропустить: тогда я буду использовать значение по умолчанию.'
} as const
