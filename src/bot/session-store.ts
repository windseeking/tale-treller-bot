import type { TrelloBoard, TrelloList } from "../trello/types.js";

type Stage = "collecting" | "selecting_board" | "selecting_list";

type Session = {
  stage: Stage;
  messages: string[];
  boards: TrelloBoard[];
  lists: TrelloList[];
  selectedBoardId?: string;
  selectedBoardName?: string;
};

const initialSession = (): Session => ({
  stage: "collecting",
  messages: [],
  boards: [],
  lists: []
});

export class SessionStore {
  private readonly sessions = new Map<number, Session>();

  public get(chatId: number): Session {
    const existing = this.sessions.get(chatId);
    if (existing) {
      return existing;
    }

    const created = initialSession();
    this.sessions.set(chatId, created);
    return created;
  }

  public resetTask(chatId: number): Session {
    const session = initialSession();
    this.sessions.set(chatId, session);
    return session;
  }
}
