import type { Clock } from '#interfaces/clock.js'
import { USER_SETTING_KEYS } from '#interfaces/settings/user-setting-keys.js'
import type { TelegramNotifier } from '#interfaces/notification/telegram-notifier.js'
import type { UserSettingsRepositoryPort } from '#interfaces/settings/user-settings-repository.js'
import type { TimeZoneValidator } from '#interfaces/settings/time-zone-validator.js'
import type { TelegramUsersRepositoryPort } from '#interfaces/telegram-user/telegram-users-repository.js'
import type { AuthSessionsRepository } from '#interfaces/trello/auth/auth-sessions-repository.js'
import type { ConnectionsRepository } from '#interfaces/trello/auth/connections-repository.js'
import type { TrelloAuthConfig } from '#interfaces/trello/auth/trello-auth-config.js'
import type { TrelloAuthSecrets } from '#interfaces/trello/auth/trello-auth-secrets.js'
import type { TrelloMemberGateway, TrelloOAuthGateway } from '#interfaces/trello/auth/oauth-gateway.js'
import type { ConnectTrelloAccountResult } from '#interfaces/trello/auth/trello-auth-results.js'

export class ConnectTrelloAccount {
  public constructor(
    private readonly telegramUsersRepository: TelegramUsersRepositoryPort,
    private readonly connectionsRepository: ConnectionsRepository,
    private readonly authSessionsRepository: AuthSessionsRepository,
    private readonly userSettingsRepository: UserSettingsRepositoryPort,
    private readonly oauthGateway: TrelloOAuthGateway,
    private readonly memberGateway: TrelloMemberGateway,
    private readonly secrets: TrelloAuthSecrets,
    private readonly timeZoneValidator: TimeZoneValidator,
    private readonly clock: Clock,
    private readonly config: TrelloAuthConfig,
    private readonly telegramNotifier?: TelegramNotifier
  ) {}

  public async call(params: {
    sid: string;
    oauthToken?: string;
    oauthVerifier?: string;
    denied?: string;
  }): Promise<ConnectTrelloAccountResult> {
    // 1. Expire stale sessions
    await this.authSessionsRepository.markExpired()

    // 2. Validate session exists and is in the expected state
    const session = await this.authSessionsRepository.findById(params.sid)
    if (!session) {
      return { ok: false, code: 'SESSION_NOT_FOUND' }
    }

    if (session.status !== 'redirected') {
      return { ok: false, code: 'SESSION_STATUS_INVALID' }
    }

    if (session.expiresAt.getTime() < this.clock.now().getTime()) {
      await this.authSessionsRepository.updateStatus(session.id, 'expired')
      return { ok: false, code: 'SESSION_EXPIRED' }
    }

    // 3. Handle user denial or missing callback params
    if (params.denied) {
      await this.authSessionsRepository.updateStatus(session.id, 'failed')
      return { ok: false, code: 'USER_DENIED' }
    }

    if (!params.oauthToken || !params.oauthVerifier) {
      await this.authSessionsRepository.updateStatus(session.id, 'failed')
      return { ok: false, code: 'MISSING_CALLBACK_PARAMS' }
    }

    // 4. Verify OAuth token matches the one stored in the session
    const storedRequestToken = session.requestTokenEncrypted
      ? this.secrets.decryptString(session.requestTokenEncrypted)
      : null
    const storedRequestTokenSecret = session.requestTokenSecretEncrypted
      ? this.secrets.decryptString(session.requestTokenSecretEncrypted)
      : null

    if (!storedRequestToken || !storedRequestTokenSecret || storedRequestToken !== params.oauthToken) {
      await this.authSessionsRepository.updateStatus(session.id, 'failed')
      return { ok: false, code: 'TOKEN_MISMATCH' }
    }

    try {
      // 5. Exchange request token for access token and fetch Trello member profile
      const accessResult = await this.oauthGateway.getAccessToken({
        oauthToken: params.oauthToken,
        oauthVerifier: params.oauthVerifier,
        requestTokenSecret: storedRequestTokenSecret
      })
      const member = await this.memberGateway.getMemberProfile(accessResult.accessToken)
      const tokenExpiresAt = new Date(this.clock.now().getTime() + this.config.trelloAuthTtlDays * 24 * 60 * 60 * 1000)

      // 6. Ensure Telegram user record exists (guard against missing /start)
      await this.telegramUsersRepository.upsert({
        telegramUserId: session.telegramUserId,
        telegramChatId: session.telegramChatId
      })

      // 7. Prefill timezone from Trello prefs if not already set
      const existingTimeZone = await this.userSettingsRepository.findValue(session.telegramUserId, USER_SETTING_KEYS.TIME_ZONE)
      const timeZone = member.timeZone && this.timeZoneValidator.isValid(member.timeZone)
        ? member.timeZone
        : null
      if (timeZone) {
        await this.userSettingsRepository.upsertValue({
          telegramUserId: session.telegramUserId,
          key: USER_SETTING_KEYS.TIME_ZONE,
          value: timeZone
        })
      }

      // 8. Persist encrypted Trello credentials
      await this.connectionsRepository.upsertActive({
        telegramUserId: session.telegramUserId,
        trelloMemberId: member.id,
        trelloUsername: member.username,
        trelloApiKeyEncrypted: this.secrets.encryptString(this.config.trelloApiKey),
        trelloTokenEncrypted: this.secrets.encryptString(accessResult.accessToken),
        tokenExpiresAt
      })

      // 9. Mark session as completed
      await this.authSessionsRepository.updateStatus(session.id, 'completed')

      // 10. Notify user; prompt timezone setup if still missing
      await this.telegramNotifier?.sendAuthSuccessNotification({
        telegramUserId: session.telegramUserId,
        telegramChatId: session.telegramChatId
      })
      if (!timeZone && !existingTimeZone) {
        await this.telegramNotifier?.sendTimeZoneSetupPrompt({
          telegramChatId: session.telegramChatId
        })
      }

      return { ok: true, code: 'CONNECTED' }
    } catch (error) {
      await this.authSessionsRepository.updateStatus(session.id, 'failed')
      throw error
    }
  }
}
