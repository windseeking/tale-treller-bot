import { env } from './env.js'
import type { TelegramNotifier } from '#interfaces/notification/telegram-notifier.js'
import type { UserSettingsRepositoryPort } from '#interfaces/settings/user-settings-repository.js'
import type { TelegramUsersRepositoryPort } from '#interfaces/telegram-user/telegram-users-repository.js'
import type { TrelloAuthContextProvider } from '#interfaces/trello/auth/trello-auth-context.js'
import type { AuthSessionsRepository } from '#interfaces/trello/auth/auth-sessions-repository.js'
import type { ConnectionsRepository } from '#interfaces/trello/auth/connections-repository.js'
import { RepositoryTrelloAuthContextProvider } from '@trello/auth/repository-trello-auth-context-provider.js'
import { IntlTimeZoneValidator } from '../infrastructure/settings/time-zone-validator.js'
import { CryptoTrelloAuthSecrets } from '../infrastructure/security/trello-auth-secrets.js'
import { SystemClock } from '../infrastructure/time/system-clock.js'
import {
  TrelloMemberHttpGateway,
  TrelloOAuthHttpGateway
} from '@trello/auth/trello-oauth-gateway.js'
import { ConnectTrelloAccount } from '../use-cases/trello/auth/connect-trello-account.js'
import { DisconnectTrelloAccount } from '../use-cases/trello/auth/disconnect-trello-account.js'
import { GetTrelloConnectionStatus } from '../use-cases/trello/auth/get-trello-connection-status.js'
import { InitiateTrelloConnection } from '../use-cases/trello/auth/initiate-trello-connection.js'
import { StartTrelloOAuthRedirect } from '../use-cases/trello/auth/start-trello-oauth-redirect.js'

export type TrelloAuthServices = {
  initConnection: InitiateTrelloConnection;
  startOAuthRedirect: StartTrelloOAuthRedirect;
  connectAccount: ConnectTrelloAccount;
  getStatus: GetTrelloConnectionStatus;
  disconnectAccount: DisconnectTrelloAccount;
  authContextProvider: TrelloAuthContextProvider;
};

export function createTrelloAuthServices(params: {
  tgUsersRepository: TelegramUsersRepositoryPort;
  trelloConnectionsRepository: ConnectionsRepository;
  trelloAuthSessionsRepository: AuthSessionsRepository;
  userSettingsRepository: UserSettingsRepositoryPort;
  tgNotifier?: TelegramNotifier;
}): TrelloAuthServices {
  const clock = new SystemClock()
  const secrets = new CryptoTrelloAuthSecrets()
  const timeZoneValidator = new IntlTimeZoneValidator()
  const config = {
    appBaseUrl: env.APP_BASE_URL,
    authSessionTtlMinutes: env.AUTH_SESSION_TTL_MINUTES,
    trelloAuthTtlDays: env.TRELLO_AUTH_TTL_DAYS,
    trelloApiKey: env.TRELLO_API_KEY
  }
  const oauthGateway = new TrelloOAuthHttpGateway(env.TRELLO_API_KEY, env.TRELLO_API_SECRET)
  const memberGateway = new TrelloMemberHttpGateway(env.TRELLO_API_KEY)

  return {
    initConnection: new InitiateTrelloConnection(
      params.tgUsersRepository,
      params.trelloAuthSessionsRepository,
      secrets,
      clock,
      config
    ),
    startOAuthRedirect: new StartTrelloOAuthRedirect(
      params.trelloAuthSessionsRepository,
      oauthGateway,
      secrets,
      clock,
      config
    ),
    connectAccount: new ConnectTrelloAccount(
      params.tgUsersRepository,
      params.trelloConnectionsRepository,
      params.trelloAuthSessionsRepository,
      params.userSettingsRepository,
      oauthGateway,
      memberGateway,
      secrets,
      timeZoneValidator,
      clock,
      config,
      params.tgNotifier
    ),
    getStatus: new GetTrelloConnectionStatus(params.trelloConnectionsRepository, clock),
    disconnectAccount: new DisconnectTrelloAccount(
      params.trelloConnectionsRepository,
      params.trelloAuthSessionsRepository
    ),
    authContextProvider: new RepositoryTrelloAuthContextProvider(
      params.trelloConnectionsRepository,
      secrets,
      clock
    )
  }
}
