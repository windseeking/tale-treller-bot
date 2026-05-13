import type {TrelloAuthContext} from '#interfaces/trello/auth/trello-auth-context.js'

export type TrelloList = {
    id: string;
    name: string;
    idBoard: string;
    closed: boolean;
    pos: number;
};

export type ListBoardListsInput = {
    boardId: string;
    auth: TrelloAuthContext;
};