export type TelegramInitDataUser = {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
};

export type ValidateTelegramInitDataResult =
  | { ok: true; user: TelegramInitDataUser; authDate: Date }
  | { ok: false; message: string };
