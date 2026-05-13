import type {UseCase} from '#interfaces/use-case.js'
import type {TrelloAuthContext} from '#interfaces/trello/auth/trello-auth-context.js'
import type {BoardsGateway} from '#interfaces/trello/boards/boards-gateway.js'
import type {TrelloBoard} from '#interfaces/trello/boards/trello-board.js'

export type ListBoardsInput = {
    auth: TrelloAuthContext;
};

export class ListTrelloBoards implements UseCase<ListBoardsInput, Promise<TrelloBoard[]>> {
    public constructor(private readonly boardsGateway: BoardsGateway) {
    }

    public call(input: ListBoardsInput): Promise<TrelloBoard[]> {
        return this.boardsGateway.getMemberBoards(input.auth)
    }
}
