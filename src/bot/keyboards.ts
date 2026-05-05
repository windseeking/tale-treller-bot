import type { TrelloBoard, TrelloList } from "../trello/types.js";
import { KNOWN_TIME_ZONE_NAMES } from "../settings/time-zone-constants.js";
import { BOT_BUTTON_LABELS } from "./actions.js";

const CANCEL_BUTTON = [{ text: BOT_BUTTON_LABELS.inlineCancel, callback_data: "action:cancel" }];
const CHANGE_BOARD_BUTTON = [{ text: BOT_BUTTON_LABELS.changeBoard, callback_data: "action:change_board" }];

type TimeZoneOption = {
  timeZone: string;
};

type TimeZoneRegion = {
  id: string;
  label: string;
  options: readonly TimeZoneOption[];
};

const TIME_ZONE_REGION_NAMES = [
  "Africa",
  "America",
  "Antarctica",
  "Arctic",
  "Asia",
  "Atlantic",
  "Australia",
  "Europe",
  "Indian",
  "Pacific"
] as const;

export const TIME_ZONE_REGIONS = TIME_ZONE_REGION_NAMES.map((regionName) => ({
  id: regionName.toLowerCase(),
  label: regionName,
  options: KNOWN_TIME_ZONE_NAMES
    .filter((timeZone) => timeZone.startsWith(`${regionName}/`))
    .map((timeZone) => ({ timeZone }))
})) satisfies readonly TimeZoneRegion[];

export const TIME_ZONE_OPTIONS = TIME_ZONE_REGIONS.flatMap((region) => region.options);

export function isTimeZoneRegionId(regionId: string): boolean {
  return TIME_ZONE_REGIONS.some((region) => region.id === regionId);
}

export function isTimeZoneOptionValue(timeZone: string): boolean {
  return TIME_ZONE_OPTIONS.some((option) => option.timeZone === timeZone);
}

export function boardsKeyboard(boards: TrelloBoard[]) {
  return {
    inline_keyboard: [
      ...boards.map((board) => [{ text: board.name, callback_data: `board:${board.id}` }]),
      CANCEL_BUTTON
    ]
  };
}

export function listsKeyboard(lists: TrelloList[]) {
  return {
    inline_keyboard: [
      ...lists.map((list) => [{ text: list.name, callback_data: `list:${list.id}` }]),
      CHANGE_BOARD_BUTTON,
      CANCEL_BUTTON
    ]
  };
}

export function cancelKeyboard() {
  return {
    inline_keyboard: [CANCEL_BUTTON]
  };
}

export function reuseSelectionKeyboard() {
  return {
    inline_keyboard: [
      [{ text: BOT_BUTTON_LABELS.useLastSelection, callback_data: "action:use_last_selection" }],
      CHANGE_BOARD_BUTTON,
      CANCEL_BUTTON
    ]
  };
}

export function cardCreatedKeyboard(cardUrl: string) {
  return {
    inline_keyboard: [[{ text: BOT_BUTTON_LABELS.openCard, url: cardUrl }]]
  };
}

export function trelloConnectKeyboard(url: string) {
  return {
    inline_keyboard: [[{ text: BOT_BUTTON_LABELS.connectTrello, url }]]
  };
}

export function unauthorizedReplyKeyboard(settingsUrl: string) {
  return {
    keyboard: [[{ text: BOT_BUTTON_LABELS.connectTrello }, settingsWebAppButton(settingsUrl)]],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

export function authorizedReplyKeyboard(settingsUrl: string) {
  return {
    keyboard: [
      [{ text: BOT_BUTTON_LABELS.createTask }, { text: BOT_BUTTON_LABELS.cancel }],
      [settingsWebAppButton(settingsUrl)],
      [{ text: BOT_BUTTON_LABELS.disconnectTrello }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

export function settingsAppKeyboard(url: string) {
  return {
    inline_keyboard: [[{ text: BOT_BUTTON_LABELS.settings, web_app: { url } }]]
  };
}

function settingsWebAppButton(url: string) {
  return { text: BOT_BUTTON_LABELS.settings, web_app: { url } };
}

export function timeZoneSetupKeyboard(autoUrl: string) {
  return {
    inline_keyboard: [
      [{ text: "Определить автоматически", url: autoUrl }],
      [{ text: "Выбрать вручную", callback_data: "settings:time_zone:manual" }]
    ]
  };
}

export function settingsMenuKeyboard() {
  return {
    inline_keyboard: [[{ text: "Часовой пояс", callback_data: "settings:time_zone" }]]
  };
}

export function manualTimeZoneRegionKeyboard() {
  return {
    inline_keyboard: TIME_ZONE_REGIONS.map((region) => [
      {
        text: region.label,
        callback_data: `settings:time_zone:region:${region.id}`
      }
    ])
  };
}

export function manualTimeZoneKeyboard(regionId: string) {
  const region = TIME_ZONE_REGIONS.find((item) => item.id === regionId);
  const options: readonly TimeZoneOption[] = region?.options ?? [];

  return {
    inline_keyboard: options.map((option) => [
      {
        text: option.timeZone,
        callback_data: `settings:time_zone:value:${encodeURIComponent(option.timeZone)}`
      }
    ])
  };
}
