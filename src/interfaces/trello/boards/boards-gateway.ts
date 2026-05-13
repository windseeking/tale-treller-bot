import type { TrelloAuthContext } from '#interfaces/trello/auth/trello-auth-context.js'
import type { TrelloBoard } from '#interfaces/trello/boards/trello-board.js'

export interface BoardsGateway {
  getMemberBoards(auth: TrelloAuthContext): Promise<TrelloBoard[]>;
}
