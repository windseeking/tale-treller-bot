import { randomUUID } from "node:crypto";

import { env } from "../config/env.js";
import { TrelloAuthSessionsRepository } from "../db/repositories/trello-auth-sessions-repository.js";
import { TrelloConnectionsRepository } from "../db/repositories/trello-connections-repository.js";
import { TelegramUsersRepository } from "../db/repositories/telegram-users-repository.js";
import { UserSettingsRepository } from "../db/repositories/user-settings-repository.js";
import { AppError } from "../errors/app-error.js";
import { normalizeError, toLogPayload } from "../errors/error-handler.js";
import { logger } from "../logger/logger.js";
import { decryptString, encryptString, generateOpaqueSecret, hashSecret, isSecretHashMatch } from "../security/crypto.js";
import { SettingsService } from "../settings/settings-service.js";
import { isValidTimeZone } from "../settings/time-zone.js";
import { authorizedReplyKeyboard, settingsAppKeyboard } from "../bot/keyboards.js";
import { BOT_MESSAGES } from "../bot/messages.js";
import { buildOAuthHeader } from "./trello-oauth.js";

const REQUEST_TOKEN_URL = "https://trello.com/1/OAuthGetRequestToken";
const AUTHORIZE_TOKEN_URL = "https://trello.com/1/OAuthAuthorizeToken";
const ACCESS_TOKEN_URL = "https://trello.com/1/OAuthGetAccessToken";
const MEMBERS_ME_URL = "https://api.trello.com/1/members/me";

type StartAuthorizationResult = {
  sid: string;
  secret: string;
  url: string;
  expiresAt: Date;
};

type StartRedirectResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; reason: string; statusCode: number };

type CallbackResult = {
  ok: boolean;
  reason: string;
};

export type TrelloConnectionStatusResult = {
  connected: boolean;
  username?: string;
  expiresAt?: Date;
  expired?: boolean;
};

export type TrelloAuthContext = {
  apiKey: string;
  token: string;
  memberId: string;
};

export class TrelloAuthService {
  public constructor(
    private readonly telegramUsersRepository: TelegramUsersRepository,
    private readonly trelloConnectionsRepository: TrelloConnectionsRepository,
    private readonly trelloAuthSessionsRepository: TrelloAuthSessionsRepository,
    private readonly userSettingsRepository: UserSettingsRepository,
    private readonly settingsService: SettingsService
  ) {}

  public async createAuthorizationLink(params: {
    telegramUserId: number;
    telegramChatId: number;
  }): Promise<StartAuthorizationResult> {
    await this.telegramUsersRepository.upsert({
      telegramUserId: params.telegramUserId,
      telegramChatId: params.telegramChatId
    });

    await this.trelloAuthSessionsRepository.markExpired();
    await this.trelloAuthSessionsRepository.failPendingByTelegramUser(params.telegramUserId);

    const sid = randomUUID();
    const secret = generateOpaqueSecret();
    const expiresAt = new Date(Date.now() + env.AUTH_SESSION_TTL_MINUTES * 60 * 1000);

    await this.trelloAuthSessionsRepository.create({
      id: sid,
      telegramUserId: params.telegramUserId,
      telegramChatId: params.telegramChatId,
      sessionSecretHash: hashSecret(secret),
      expiresAt
    });

    const baseUrl = new URL("/auth/trello/start", env.APP_BASE_URL);
    baseUrl.searchParams.set("sid", sid);
    baseUrl.searchParams.set("secret", secret);

    return {
      sid,
      secret,
      url: baseUrl.toString(),
      expiresAt
    };
  }

  public async startAuthRedirect(params: { sid: string; secret: string }): Promise<StartRedirectResult> {
    await this.trelloAuthSessionsRepository.markExpired();

    const session = await this.trelloAuthSessionsRepository.findById(params.sid);
    if (!session) {
      return { ok: false, reason: BOT_MESSAGES.authServiceSessionNotFound, statusCode: 404 };
    }

    if (session.status !== "pending") {
      return {
        ok: false,
        reason: BOT_MESSAGES.authServiceSessionAlreadyUsed,
        statusCode: 409
      };
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await this.trelloAuthSessionsRepository.updateStatus(session.id, "expired");
      return { ok: false, reason: BOT_MESSAGES.authServiceSessionExpired, statusCode: 410 };
    }

    if (!isSecretHashMatch({ secret: params.secret, hash: session.sessionSecretHash })) {
      return { ok: false, reason: BOT_MESSAGES.authServiceSessionSecretInvalid, statusCode: 403 };
    }

    const callbackUrl = new URL("/auth/trello/callback", env.APP_BASE_URL);
    callbackUrl.searchParams.set("sid", session.id);

    const authHeader = buildOAuthHeader({
      method: "POST",
      url: REQUEST_TOKEN_URL,
      consumerKey: env.TRELLO_API_KEY,
      consumerSecret: env.TRELLO_API_SECRET,
      extraOAuthParams: {
        oauth_callback: callbackUrl.toString()
      }
    });

    const response = await fetch(REQUEST_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: authHeader
      }
    });

    const payloadText = await response.text();
    if (!response.ok) {
      await this.trelloAuthSessionsRepository.updateStatus(session.id, "failed");
      throw new AppError({
        message: "Trello request token exchange failed",
        code: "TRELLO_REQUEST_TOKEN_FAILED",
        statusCode: response.status,
        details: {
          status: response.status,
          response: payloadText
        }
      });
    }

    const paramsResponse = new URLSearchParams(payloadText);
    const requestToken = paramsResponse.get("oauth_token");
    const requestTokenSecret = paramsResponse.get("oauth_token_secret");

    if (!requestToken || !requestTokenSecret) {
      await this.trelloAuthSessionsRepository.updateStatus(session.id, "failed");
      throw new AppError({
        message: "Trello request token response is invalid",
        code: "TRELLO_REQUEST_TOKEN_INVALID",
        details: {
          response: payloadText
        }
      });
    }

    await this.trelloAuthSessionsRepository.updateRedirected({
      id: session.id,
      requestTokenEncrypted: encryptString(requestToken),
      requestTokenSecretEncrypted: encryptString(requestTokenSecret)
    });

    const authorizeUrl = new URL(AUTHORIZE_TOKEN_URL);
    authorizeUrl.searchParams.set("oauth_token", requestToken);
    authorizeUrl.searchParams.set("name", "Telegram Trello Bot");
    authorizeUrl.searchParams.set("scope", "read,write");
    authorizeUrl.searchParams.set("expiration", "never");

    return { ok: true, redirectUrl: authorizeUrl.toString() };
  }

  public async handleCallback(params: {
    sid: string;
    oauthToken?: string;
    oauthVerifier?: string;
    denied?: string;
  }): Promise<CallbackResult> {
    await this.trelloAuthSessionsRepository.markExpired();

    const session = await this.trelloAuthSessionsRepository.findById(params.sid);
    if (!session) {
      return { ok: false, reason: BOT_MESSAGES.authServiceSessionNotFound };
    }

    if (session.status !== "redirected") {
      return { ok: false, reason: BOT_MESSAGES.authServiceSessionStatusInvalid };
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await this.trelloAuthSessionsRepository.updateStatus(session.id, "expired");
      return { ok: false, reason: BOT_MESSAGES.authServiceSessionExpired };
    }

    if (params.denied) {
      await this.trelloAuthSessionsRepository.updateStatus(session.id, "failed");
      return { ok: false, reason: BOT_MESSAGES.authServiceUserDenied };
    }

    if (!params.oauthToken || !params.oauthVerifier) {
      await this.trelloAuthSessionsRepository.updateStatus(session.id, "failed");
      return { ok: false, reason: BOT_MESSAGES.authServiceMissingCallbackParams };
    }

    const storedRequestToken = session.requestTokenEncrypted
      ? decryptString(session.requestTokenEncrypted)
      : null;
    const storedRequestTokenSecret = session.requestTokenSecretEncrypted
      ? decryptString(session.requestTokenSecretEncrypted)
      : null;

    if (!storedRequestToken || !storedRequestTokenSecret || storedRequestToken !== params.oauthToken) {
      await this.trelloAuthSessionsRepository.updateStatus(session.id, "failed");
      return { ok: false, reason: BOT_MESSAGES.authServiceTokenMismatch };
    }

    const authHeader = buildOAuthHeader({
      method: "POST",
      url: ACCESS_TOKEN_URL,
      consumerKey: env.TRELLO_API_KEY,
      consumerSecret: env.TRELLO_API_SECRET,
      token: params.oauthToken,
      tokenSecret: storedRequestTokenSecret,
      extraOAuthParams: {
        oauth_verifier: params.oauthVerifier
      }
    });

    const accessResponse = await fetch(ACCESS_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: authHeader
      }
    });

    const accessPayload = await accessResponse.text();
    if (!accessResponse.ok) {
      await this.trelloAuthSessionsRepository.updateStatus(session.id, "failed");
      throw new AppError({
        message: "Trello access token exchange failed",
        code: "TRELLO_ACCESS_TOKEN_FAILED",
        statusCode: accessResponse.status,
        details: {
          status: accessResponse.status,
          response: accessPayload
        }
      });
    }

    const accessParams = new URLSearchParams(accessPayload);
    const accessToken = accessParams.get("oauth_token");

    if (!accessToken) {
      await this.trelloAuthSessionsRepository.updateStatus(session.id, "failed");
      throw new AppError({
        message: "Trello access token response is invalid",
        code: "TRELLO_ACCESS_TOKEN_INVALID",
        details: {
          response: accessPayload
        }
      });
    }

    const memberResponse = await fetch(
      `${MEMBERS_ME_URL}?key=${encodeURIComponent(env.TRELLO_API_KEY)}&token=${encodeURIComponent(accessToken)}&fields=id,username,prefs`
    );
    const memberPayload = await memberResponse.text();
    let memberData: unknown = null;
    try {
      memberData = JSON.parse(memberPayload);
    } catch {
      memberData = null;
    }

    if (!memberResponse.ok || !isMemberPayload(memberData)) {
      await this.trelloAuthSessionsRepository.updateStatus(session.id, "failed");
      throw new AppError({
        message: "Trello member profile fetch failed",
        code: "TRELLO_MEMBER_FETCH_FAILED",
        statusCode: memberResponse.status,
        details: {
          status: memberResponse.status,
          response: memberData ?? memberPayload
        }
      });
    }

    const tokenExpiresAt = new Date(Date.now() + env.TRELLO_AUTH_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.telegramUsersRepository.upsert({
      telegramUserId: session.telegramUserId,
      telegramChatId: session.telegramChatId
    });

    const existingTimeZone = await this.userSettingsRepository.findTimeZone(session.telegramUserId);
    const timeZone = extractValidTimeZone(memberData);
    if (timeZone) {
      await this.userSettingsRepository.upsertTimeZone({
        telegramUserId: session.telegramUserId,
        timeZone
      });
    }

    await this.trelloConnectionsRepository.upsertActive({
      telegramUserId: session.telegramUserId,
      trelloMemberId: memberData.id,
      trelloUsername: memberData.username,
      trelloApiKeyEncrypted: encryptString(env.TRELLO_API_KEY),
      trelloTokenEncrypted: encryptString(accessToken),
      tokenExpiresAt
    });

    await this.trelloAuthSessionsRepository.updateStatus(session.id, "completed");

    await this.sendTelegramSuccessNotification({
      telegramUserId: session.telegramUserId,
      telegramChatId: session.telegramChatId
    });
    if (!timeZone && !existingTimeZone) {
      await this.sendTimeZoneSetupPrompt({
        telegramUserId: session.telegramUserId,
        telegramChatId: session.telegramChatId
      });
    }

    return { ok: true, reason: BOT_MESSAGES.authServiceConnected };
  }

  public async getConnectionStatus(telegramUserId: number): Promise<TrelloConnectionStatusResult> {
    const connection = await this.trelloConnectionsRepository.findByTelegramUserId(telegramUserId);

    if (!connection || connection.status !== "active" || connection.revokedAt) {
      return { connected: false };
    }

    const expired = connection.tokenExpiresAt.getTime() <= Date.now();

    return {
      connected: !expired,
      username: connection.trelloUsername,
      expiresAt: connection.tokenExpiresAt,
      expired
    };
  }

  public async getActiveAuthContext(telegramUserId: number): Promise<TrelloAuthContext | null> {
    const connection = await this.trelloConnectionsRepository.findByTelegramUserId(telegramUserId);

    if (!connection || connection.status !== "active" || connection.revokedAt) {
      return null;
    }

    if (connection.tokenExpiresAt.getTime() <= Date.now()) {
      return null;
    }

    return {
      apiKey: decryptString(connection.trelloApiKeyEncrypted),
      token: decryptString(connection.trelloTokenEncrypted),
      memberId: connection.trelloMemberId
    };
  }

  public async revokeConnection(telegramUserId: number): Promise<void> {
    await this.trelloConnectionsRepository.revoke(telegramUserId);
    await this.trelloAuthSessionsRepository.failPendingByTelegramUser(telegramUserId);
  }

  private async sendTelegramSuccessNotification(params: {
    telegramUserId: number;
    telegramChatId: number;
  }): Promise<void> {
    try {
      const link = await this.settingsService.createAppLaunchLink({
        telegramUserId: params.telegramUserId,
        telegramChatId: params.telegramChatId
      });
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: params.telegramChatId,
          text: BOT_MESSAGES.authServiceConnectedNotification,
          reply_markup: authorizedReplyKeyboard(link.url)
        })
      });
    } catch (error) {
      const normalized = normalizeError(error);
      logger.warn(toLogPayload(normalized, { scope: "telegram", action: "sendAuthSuccessNotification" }));
    }
  }

  private async sendTimeZoneSetupPrompt(params: {
    telegramUserId: number;
    telegramChatId: number;
  }): Promise<void> {
    try {
      const link = await this.settingsService.createAppLaunchLink({
        telegramUserId: params.telegramUserId,
        telegramChatId: params.telegramChatId
      });

      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: params.telegramChatId,
          text: BOT_MESSAGES.timeZoneSetupIntro,
          reply_markup: settingsAppKeyboard(link.url)
        })
      });
    } catch (error) {
      const normalized = normalizeError(error);
      logger.warn(toLogPayload(normalized, { scope: "telegram", action: "sendTimeZoneSetupPrompt" }));
    }
  }
}

function isMemberPayload(value: unknown): value is { id: string; username: string; prefs?: unknown } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "id" in value &&
    typeof value.id === "string" &&
    "username" in value &&
    typeof value.username === "string"
  );
}

function extractValidTimeZone(member: { prefs?: unknown }): string | null {
  const prefs = member.prefs;
  if (typeof prefs !== "object" || prefs === null) {
    return null;
  }

  if ("timezone" in prefs && typeof prefs.timezone === "string" && isValidTimeZone(prefs.timezone)) {
    return prefs.timezone;
  }

  if ("timezoneInfo" in prefs && typeof prefs.timezoneInfo === "object" && prefs.timezoneInfo !== null) {
    const timezoneInfo = prefs.timezoneInfo;
    if ("timezone" in timezoneInfo && typeof timezoneInfo.timezone === "string" && isValidTimeZone(timezoneInfo.timezone)) {
      return timezoneInfo.timezone;
    }
  }

  return null;
}
