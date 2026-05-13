export interface TrelloCard {
    id: string,
    name: string
    desc: string
    url: string
    shortUrl: string
    idList: string
    idBoard: string
}

export type TrelloCardInput = {
    telegramUserId: number;
    text: string;
    currentDate: string;
    boardId: string;
    listId: string;
};
