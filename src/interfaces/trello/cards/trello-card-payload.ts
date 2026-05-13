export interface TrelloCardPayload {
  name: string;
  desc: string;
  idList: string;
  due?: string;
  urlSource?: string;
  pos: 'top';
}
