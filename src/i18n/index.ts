import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../shared/i18n/index.js'
import enCatalog from './locales/en.json' with { type: 'json' }
import ruCatalog from './locales/ru.json' with { type: 'json' }

type I18nNode = {
  __: (phrase: { phrase: string; locale: string }, params?: Record<string, unknown>) => string;
};

type I18nConstructor = new (options: {
  locales: readonly string[];
  defaultLocale: string;
  directory: string;
  objectNotation: boolean;
  updateFiles: boolean;
  retryInDefaultLocale: boolean;
}) => I18nNode;

export type BotButtonLabelKey = keyof typeof enCatalog.bot.buttons;
export type BotButtonLabels = Record<BotButtonLabelKey, string>;

export type BotMessages = {
  welcomeAuthorized: string;
  welcomeUnauthorized: string;
  tooShort: (length: number) => string;
  draftEmpty: string;
  pickBoard: string;
  noBoards: string;
  reuseSelection: (boardName: string, listName: string) => string;
  pickList: string;
  boardSelected: (boardName: string) => string;
  listSelected: (listName: string) => string;
  noLists: string;
  canceled: string;
  boardChanged: string;
  waitLastSelection: string;
  waitBoard: string;
  waitList: string;
  cardCreated: (cardName: string, cardShortUrl: string) => string;
  cardInProgress: string;
  readyForNextDraft: string;
  genericError: string;
  unsupportedMessage: string;
  authRequired: string;
  authLinkCreated: (expiresAt: string) => string;
  authDisconnected: string;
  authStatusConnected: (username: string, expiresAt: string) => string;
  authStatusExpired: (username: string, expiresAt: string) => string;
  authStatusNotConnected: string;
  authFlowInterrupted: string;
  authServiceSessionNotFound: string;
  authServiceSessionAlreadyUsed: string;
  authServiceSessionExpired: string;
  authServiceSessionSecretInvalid: string;
  authServiceSessionStatusInvalid: string;
  authServiceUserDenied: string;
  authServiceMissingCallbackParams: string;
  authServiceTokenMismatch: string;
  authServiceConnected: string;
  authServiceConnectedNotification: string;
  timeZoneSetupIntro: string;
  unknownDateTime: string;
};

export type BotAuthPageMessages = typeof enCatalog.bot.authPage;
export type AppApiMessages = typeof enCatalog.appApi;

const require = createRequire(import.meta.url)
const { I18n } = require('i18n') as { I18n: I18nConstructor }
const LOCALES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'locales')

const backendI18n = new I18n({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  directory: LOCALES_DIR,
  objectNotation: true,
  updateFiles: false,
  retryInDefaultLocale: true
})

export function botButtons(locale: SupportedLocale): BotButtonLabels {
  return {
    connectTrello: botT(locale, 'buttons.connectTrello'),
    statusTrello: botT(locale, 'buttons.statusTrello'),
    disconnectTrello: botT(locale, 'buttons.disconnectTrello'),
    createTask: botT(locale, 'buttons.createTask'),
    cancel: botT(locale, 'buttons.cancel'),
    inlineCancel: botT(locale, 'buttons.inlineCancel'),
    changeBoard: botT(locale, 'buttons.changeBoard'),
    useLastSelection: botT(locale, 'buttons.useLastSelection'),
    openCard: botT(locale, 'buttons.openCard')
  }
}

export function botMessages(locale: SupportedLocale): BotMessages {
  return {
    welcomeAuthorized: botT(locale, 'messages.welcomeAuthorized'),
    welcomeUnauthorized: botT(locale, 'messages.welcomeUnauthorized'),
    tooShort: (length) => botT(locale, 'messages.tooShort', { length }),
    draftEmpty: botT(locale, 'messages.draftEmpty'),
    pickBoard: botT(locale, 'messages.pickBoard'),
    noBoards: botT(locale, 'messages.noBoards'),
    reuseSelection: (boardName, listName) => botT(locale, 'messages.reuseSelection', { boardName, listName }),
    pickList: botT(locale, 'messages.pickList'),
    boardSelected: (boardName) => botT(locale, 'messages.boardSelected', { boardName }),
    listSelected: (listName) => botT(locale, 'messages.listSelected', { listName }),
    noLists: botT(locale, 'messages.noLists'),
    canceled: botT(locale, 'messages.canceled'),
    boardChanged: botT(locale, 'messages.boardChanged'),
    waitLastSelection: botT(locale, 'messages.waitLastSelection'),
    waitBoard: botT(locale, 'messages.waitBoard'),
    waitList: botT(locale, 'messages.waitList'),
    cardCreated: (cardName, cardShortUrl) => botT(locale, 'messages.cardCreated', { cardName, cardShortUrl }),
    cardInProgress: botT(locale, 'messages.cardInProgress'),
    readyForNextDraft: botT(locale, 'messages.readyForNextDraft'),
    genericError: botT(locale, 'messages.genericError'),
    unsupportedMessage: botT(locale, 'messages.unsupportedMessage'),
    authRequired: botT(locale, 'messages.authRequired'),
    authLinkCreated: (expiresAt) => botT(locale, 'messages.authLinkCreated', { expiresAt }),
    authDisconnected: botT(locale, 'messages.authDisconnected'),
    authStatusConnected: (username, expiresAt) => botT(locale, 'messages.authStatusConnected', { username, expiresAt }),
    authStatusExpired: (username, expiresAt) => botT(locale, 'messages.authStatusExpired', { username, expiresAt }),
    authStatusNotConnected: botT(locale, 'messages.authStatusNotConnected'),
    authFlowInterrupted: botT(locale, 'messages.authFlowInterrupted'),
    authServiceSessionNotFound: botT(locale, 'messages.authServiceSessionNotFound'),
    authServiceSessionAlreadyUsed: botT(locale, 'messages.authServiceSessionAlreadyUsed'),
    authServiceSessionExpired: botT(locale, 'messages.authServiceSessionExpired'),
    authServiceSessionSecretInvalid: botT(locale, 'messages.authServiceSessionSecretInvalid'),
    authServiceSessionStatusInvalid: botT(locale, 'messages.authServiceSessionStatusInvalid'),
    authServiceUserDenied: botT(locale, 'messages.authServiceUserDenied'),
    authServiceMissingCallbackParams: botT(locale, 'messages.authServiceMissingCallbackParams'),
    authServiceTokenMismatch: botT(locale, 'messages.authServiceTokenMismatch'),
    authServiceConnected: botT(locale, 'messages.authServiceConnected'),
    authServiceConnectedNotification: botT(locale, 'messages.authServiceConnectedNotification'),
    timeZoneSetupIntro: botT(locale, 'messages.timeZoneSetupIntro'),
    unknownDateTime: botT(locale, 'messages.unknownDateTime')
  }
}

export function botAuthPageMessages(locale: SupportedLocale): BotAuthPageMessages {
  return {
    genericErrorTitle: botT(locale, 'authPage.genericErrorTitle'),
    authErrorTitle: botT(locale, 'authPage.authErrorTitle'),
    badAuthLink: botT(locale, 'authPage.badAuthLink'),
    authStartFailed: botT(locale, 'authPage.authStartFailed'),
    missingSessionId: botT(locale, 'authPage.missingSessionId'),
    authIncompleteTitle: botT(locale, 'authPage.authIncompleteTitle'),
    callbackFailed: botT(locale, 'authPage.callbackFailed'),
    fallbackResultMessage: botT(locale, 'authPage.fallbackResultMessage'),
    successTitle: botT(locale, 'authPage.successTitle'),
    resultTitle: botT(locale, 'authPage.resultTitle'),
    appUnavailableTitle: botT(locale, 'authPage.appUnavailableTitle'),
    appNotBuilt: botT(locale, 'authPage.appNotBuilt'),
    returnHint: botT(locale, 'authPage.returnHint')
  }
}

export function appApiMessages(locale: SupportedLocale): AppApiMessages {
  return {
    openFromTelegram: appApiT(locale, 'openFromTelegram'),
    genericActionFailed: appApiT(locale, 'genericActionFailed'),
    invalidTimeZone: appApiT(locale, 'invalidTimeZone'),
    invalidLocale: appApiT(locale, 'invalidLocale'),
    initData: {
      authRequired: appApiT(locale, 'initData.authRequired'),
      missingHash: appApiT(locale, 'initData.missingHash'),
      invalidSignature: appApiT(locale, 'initData.invalidSignature'),
      invalidAuthDate: appApiT(locale, 'initData.invalidAuthDate'),
      expired: appApiT(locale, 'initData.expired'),
      missingUser: appApiT(locale, 'initData.missingUser'),
      invalidUser: appApiT(locale, 'initData.invalidUser')
    }
  }
}

export function botT(locale: SupportedLocale, key: string, params?: Record<string, unknown>): string {
  return backendI18n.__({ phrase: `bot.${key}`, locale }, params)
}

function appApiT(locale: SupportedLocale, key: string): string {
  return backendI18n.__({ phrase: `appApi.${key}`, locale })
}
