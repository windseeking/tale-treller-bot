import type { SettingsPayload } from '#interfaces/settings/settings-payload.js'
import type { TrelloConnection } from '#interfaces/trello/auth/connections-repository.js'

export type AppPayload = {
  settings: SettingsPayload;
  trello: TrelloConnection;
};
