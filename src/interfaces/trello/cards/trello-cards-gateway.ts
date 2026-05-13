import type { TrelloAuthContext } from '#interfaces/trello/auth/trello-auth-context.js'
import type { TrelloCard } from '#interfaces/trello/cards/trello-card.js'
import type { TrelloCardPayload } from '#interfaces/trello/cards/trello-card-payload.js'

export interface TrelloCardsGateway {
    createCard(payload: TrelloCardPayload, auth: TrelloAuthContext): Promise<TrelloCard>;
}
