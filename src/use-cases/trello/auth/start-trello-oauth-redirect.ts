import type { Clock } from '#interfaces/clock.js'
import type { AuthSessionsRepository } from '#interfaces/trello/auth/auth-sessions-repository.js'
import type { TrelloAuthConfig } from '#interfaces/trello/auth/trello-auth-config.js'
import type { TrelloAuthSecrets } from '#interfaces/trello/auth/trello-auth-secrets.js'
import type { TrelloOAuthGateway } from '#interfaces/trello/auth/oauth-gateway.js'
import type { StartRedirectResult } from '#interfaces/trello/auth/trello-auth-results.js'

export class StartTrelloOAuthRedirect {
  public constructor(
    private readonly authSessionsRepository: AuthSessionsRepository,
    private readonly oauthGateway: TrelloOAuthGateway,
    private readonly secrets: TrelloAuthSecrets,
    private readonly clock: Clock,
    private readonly config: TrelloAuthConfig
  ) {}

  public async call(params: { sid: string; secret: string }): Promise<StartRedirectResult> {
    await this.authSessionsRepository.markExpired()

    const session = await this.authSessionsRepository.findById(params.sid)
    if (!session) {
      return { ok: false, code: 'SESSION_NOT_FOUND' }
    }

    if (session.status !== 'pending') {
      return { ok: false, code: 'SESSION_ALREADY_USED' }
    }

    if (session.expiresAt.getTime() < this.clock.now().getTime()) {
      await this.authSessionsRepository.updateStatus(session.id, 'expired')
      return { ok: false, code: 'SESSION_EXPIRED' }
    }

    if (!this.secrets.isSecretHashMatch({ secret: params.secret, hash: session.sessionSecretHash })) {
      return { ok: false, code: 'SESSION_SECRET_INVALID' }
    }

    const callbackUrl = new URL('/auth/trello/callback', this.config.appBaseUrl)
    callbackUrl.searchParams.set('sid', session.id)

    try {
      const tokenResult = await this.oauthGateway.getRequestToken(callbackUrl.toString())
      await this.authSessionsRepository.updateRedirected({
        id: session.id,
        requestTokenEncrypted: this.secrets.encryptString(tokenResult.requestToken),
        requestTokenSecretEncrypted: this.secrets.encryptString(tokenResult.requestTokenSecret)
      })

      return { ok: true, redirectUrl: this.oauthGateway.buildAuthorizeUrl(tokenResult.requestToken) }
    } catch (error) {
      await this.authSessionsRepository.updateStatus(session.id, 'failed')
      throw error
    }
  }
}
