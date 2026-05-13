import type { TrelloAuthContext } from '#interfaces/trello/auth/trello-auth-context.js'
import type { GeneratedTaskOutput } from '#interfaces/task/task-generator.js'
import type { TaskPayloadMapper } from '#interfaces/task/task-payload-mapper.js'
import type { TrelloCardPayload } from '#interfaces/trello/cards/trello-card-payload.js'
import type { TrelloCardInput } from '#interfaces/trello/cards/trello-card.js'

export class TrelloCardPayloadMapper
  implements TaskPayloadMapper<TrelloCardInput, GeneratedTaskOutput, TrelloAuthContext, TrelloCardPayload> {
  public map(params: {
    input: TrelloCardInput;
    generated: GeneratedTaskOutput;
    context: TrelloAuthContext;
  }): TrelloCardPayload {
    return {
      name: params.generated.name,
      desc: params.generated.desc,
      due: params.generated.due,
      urlSource: params.generated.urlSource,
      idList: params.input.listId,
      pos: 'top'
    }
  }
}
