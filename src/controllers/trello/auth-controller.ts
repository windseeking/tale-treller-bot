import type { ConnectTrelloAccount } from '#usecases/trello/auth/connect-trello-account.js'
import type { StartTrelloOAuthRedirect } from '#usecases/trello/auth/start-trello-oauth-redirect.js'
import { buildTrelloAuthResultUrl, presentTrelloAuthMessage, presentTrelloAuthStartStatusCode } from '../../presenters/trello/auth-result-presenter.js'

// todo: unify types of use-cases returns

export class TrelloAuthController {
  public constructor(
    private readonly startTrelloOAuthRedirect: StartTrelloOAuthRedirect,
    private readonly connectTrelloAccount: ConnectTrelloAccount
  ) {}

  public async start(params: { sid: string; secret: string }): Promise<
    | { ok: true; redirectUrl: string }
    | { ok: false; reason: string; statusCode: number }
  > {
    const result = await this.startTrelloOAuthRedirect.call(params)
    if (result.ok) {
      return result
    }

    return {
      ok: false,
      reason: presentTrelloAuthMessage(result.code),
      statusCode: presentTrelloAuthStartStatusCode(result.code)
    }
  }

  public async complete(params: {
    sid: string;
    oauthToken?: string;
    oauthVerifier?: string;
    denied?: string;
  }): Promise<{ ok: true; resultUrl: string } | { ok: false; reason: string }> {
    const result = await this.connectTrelloAccount.call(params)
    if (!result.ok) {
      return { ok: false, reason: presentTrelloAuthMessage(result.code) }
    }

    return {
      ok: true,
      resultUrl: buildTrelloAuthResultUrl('success', presentTrelloAuthMessage(result.code))
    }
  }
}
