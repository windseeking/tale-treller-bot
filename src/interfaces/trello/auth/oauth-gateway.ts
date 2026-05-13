export type TrelloRequestTokenResult = {
  requestToken: string;
  requestTokenSecret: string;
};

export type TrelloAccessTokenResult = {
  accessToken: string;
};

export type TrelloMemberProfile = {
  id: string;
  username: string;
  prefs?: unknown;
  timeZone?: string | null;
};

export interface TrelloOAuthGateway {
  getRequestToken(callbackUrl: string): Promise<TrelloRequestTokenResult>;
  getAccessToken(params: {
    oauthToken: string;
    oauthVerifier: string;
    requestTokenSecret: string;
  }): Promise<TrelloAccessTokenResult>;
  buildAuthorizeUrl(requestToken: string): string;
}

export interface TrelloMemberGateway {
  getMemberProfile(accessToken: string): Promise<TrelloMemberProfile>;
}
