import type { TrelloConnection } from './connections-repository.js'

export type TrelloAuthResultCode =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_ALREADY_USED'
  | 'SESSION_EXPIRED'
  | 'SESSION_SECRET_INVALID'
  | 'SESSION_STATUS_INVALID'
  | 'USER_DENIED'
  | 'MISSING_CALLBACK_PARAMS'
  | 'TOKEN_MISMATCH'
  | 'CONNECTED';

export type StartAuthorizationResult = {
  sid: string;
  secret: string;
  url: string;
  expiresAt: Date;
};

export type StartRedirectResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; code: TrelloAuthResultCode };

export type ConnectTrelloAccountResult =
  | { ok: true; code: 'CONNECTED' }
  | { ok: false; code: Exclude<TrelloAuthResultCode, 'CONNECTED'> };

export type TrelloConnectionStatusResult = {
  connected: TrelloConnection['connected'];
  username?: NonNullable<TrelloConnection['username']>;
  expiresAt?: Date;
  expired?: TrelloConnection['expired'];
};

