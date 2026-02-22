import type { TrelloBoard, TrelloList } from "../trello/types.js";

const CANCEL_BUTTON = [{ text: "Отмена", callback_data: "action:cancel" }];
const CHANGE_BOARD_BUTTON = [{ text: "Поменять доску", callback_data: "action:change_board" }];

export function boardsKeyboard(boards: TrelloBoard[]) {
  return {
    inline_keyboard: [
      ...boards.map((board) => [{ text: board.name, callback_data: `board:${board.id}` }]),
      CANCEL_BUTTON
    ]
  };
}

export function listsKeyboard(lists: TrelloList[]) {
  return {
    inline_keyboard: [
      ...lists.map((list) => [{ text: list.name, callback_data: `list:${list.id}` }]),
      CHANGE_BOARD_BUTTON,
      CANCEL_BUTTON
    ]
  };
}

export function cancelKeyboard() {
  return {
    inline_keyboard: [CANCEL_BUTTON]
  };
}
