export type TimeZoneOption = {
  name: string;
  offset: string;
};

export type SettingsPayload = {
  timeZone: string | null;
  isDefaultTimeZone: boolean;
  defaultTimeZone: string;
};

export type TrelloPayload = {
  connected: boolean;
  username: string | null;
  expiresAt: string | null;
  expired: boolean;
};

export type AppPayload = {
  settings: SettingsPayload;
  trello: TrelloPayload;
};
