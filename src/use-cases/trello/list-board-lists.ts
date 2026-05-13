import type { ListBoardListsInput, TrelloList } from '#interfaces/trello/lists/trello-list.js'
import type { ListsGateway } from '#interfaces/trello/lists/lists-gateway.js'
import type { UseCase } from '#interfaces/use-case.js'

export class ListBoardLists implements UseCase<ListBoardListsInput, Promise<TrelloList[]>> {
  public constructor(private readonly listsGateway: ListsGateway) {}

  public call(input: ListBoardListsInput): Promise<TrelloList[]> {
    return this.listsGateway.getBoardLists(input.boardId, input.auth)
  }
}
