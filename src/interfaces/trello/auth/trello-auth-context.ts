export type TrelloAuthContext = {
  apiKey: string;
  token: string;
  memberId: string;
};

export interface TrelloAuthContextProvider {
  getActiveAuthContext(telegramUserId: number): Promise<TrelloAuthContext | null>;
}