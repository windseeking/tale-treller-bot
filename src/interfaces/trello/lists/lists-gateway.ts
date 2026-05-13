import type { TrelloAuthContext } from '../auth/trello-auth-context.js'
import type { TrelloList } from './trello-list.js'

export interface ListsGateway {
  getBoardLists(boardId: string, auth: TrelloAuthContext): Promise<TrelloList[]>;
}
