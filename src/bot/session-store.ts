import type { TrelloBoard, TrelloList } from "../trello/types.js";

type Stage = "collecting" | "confirming_last_selection" | "selecting_board" | "selecting_list";

type Session = {
  stage: Stage;
  messages: string[];
  boards: TrelloBoard[];
  lists: TrelloList[];
  selectedBoardId?: string;
  selectedBoardName?: string;
  selectedListId?: string;
  selectedListName?: string;
  lastBoardId?: string;
  lastBoardName?: string;
  lastListId?: string;
  lastListName?: string;
};

export class SessionStore {
  private readonly sessions = new Map<number, Session>();

  public get(chatId: number): Session {
    const existing = this.sessions.get(chatId);
    if (existing) {
      return existing;
    }

    const created: Session = {
      stage: "collecting",
      messages: [],
      boards: [],
      lists: []
    };
    this.sessions.set(chatId, created);
    return created;
  }

  public resetTask(chatId: number): Session {
    const existing = this.sessions.get(chatId);
    if (!existing) {
      const created: Session = {
        stage: "collecting",
        messages: [],
        boards: [],
        lists: []
      };
      this.sessions.set(chatId, created);
      return created;
    }

    existing.stage = "collecting";
    existing.messages = [];
    existing.boards = [];
    existing.lists = [];
    existing.selectedBoardId = undefined;
    existing.selectedBoardName = undefined;
    existing.selectedListId = undefined;
    existing.selectedListName = undefined;

    return existing;
  }
}
