export type TrelloAuthContext = {
  apiKey: string;
  token: string;
  memberId: string;
};

export type TrelloBoard = {
  id: string;
  name: string;
  url: string;
  closed: boolean;
};

export type TrelloList = {
  id: string;
  name: string;
  idBoard: string;
  closed: boolean;
  pos: number;
};

export type CreateTrelloCardInput = {
  name: string;
  desc: string;
  pos: 'top';
  idList: string;
  due?: string;
  urlSource?: string;
};

export type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  url: string;
  shortUrl: string;
  idBoard: string;
  idList: string;
};
