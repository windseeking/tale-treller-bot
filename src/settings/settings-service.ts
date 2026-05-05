import { randomUUID } from "node:crypto";

import { env } from "../config/env.js";
import { AppSessionsRepository } from "../db/repositories/app-sessions-repository.js";
import type { AppSessionRecord } from "../db/repositories/types.js";
import { SettingsUpdateSessionsRepository } from "../db/repositories/settings-update-sessions-repository.js";
import { UserSettingsRepository } from "../db/repositories/user-settings-repository.js";
import { normalizeError, toLogPayload } from "../errors/error-handler.js";
import { logger } from "../logger/logger.js";
import { generateOpaqueSecret, hashSecret, isSecretHashMatch } from "../security/crypto.js";
import { isValidTimeZone } from "./time-zone.js";

type CreateAutoTimeZoneLinkResult = {
  url: string;
  expiresAt: Date;
};

type CompleteAutoTimeZoneResult =
  | { ok: true; message: string }
  | { ok: false; statusCode: number; message: string };

const SETTINGS_SESSION_TTL_MINUTES = 15;
const APP_SESSION_TTL_MINUTES = 30;

export class SettingsService {
  public constructor(
    private readonly userSettingsRepository: UserSettingsRepository,
    private readonly settingsUpdateSessionsRepository: SettingsUpdateSessionsRepository,
    private readonly appSessionsRepository: AppSessionsRepository
  ) {}

  public async createAppLaunchLink(params: {
    telegramUserId: number;
    telegramChatId: number;
  }): Promise<CreateAutoTimeZoneLinkResult> {
    await this.appSessionsRepository.markExpired();

    const sid = randomUUID();
    const secret = generateOpaqueSecret();
    const expiresAt = new Date(Date.now() + APP_SESSION_TTL_MINUTES * 60 * 1000);

    await this.appSessionsRepository.create({
      id: sid,
      telegramUserId: params.telegramUserId,
      telegramChatId: params.telegramChatId,
      sessionSecretHash: hashSecret(secret),
      expiresAt
    });

    const url = new URL("/app", env.APP_BASE_URL);
    url.searchParams.set("sid", sid);
    url.searchParams.set("secret", secret);

    return { url: url.toString(), expiresAt };
  }

  public async exchangeAppSession(params: {
    sid: string;
    secret: string;
  }): Promise<
    | { ok: true; token: string; session: AppSessionRecord }
    | { ok: false; statusCode: number; message: string }
  > {
    await this.appSessionsRepository.markExpired();

    const session = await this.appSessionsRepository.findById(params.sid);
    if (!session) {
      return { ok: false, statusCode: 404, message: "Сессия приложения не найдена." };
    }

    /*if (session.status !== "pending") {
      return { ok: false, statusCode: 409, message: "Ссылка приложения уже использована." };
    }*/

    /*if (session.expiresAt.getTime() < Date.now()) {
      await this.appSessionsRepository.updateStatus(session.id, "expired");
      return { ok: false, statusCode: 410, message: "Ссылка приложения истекла." };
    }*/

    if (!isSecretHashMatch({ secret: params.secret, hash: session.sessionSecretHash })) {
      return { ok: false, statusCode: 403, message: "Некорректная ссылка приложения." };
    }

    const token = generateOpaqueSecret();
    const apiTokenHash = hashSecret(token);
    await this.appSessionsRepository.activate({ id: session.id, apiTokenHash });

    return {
      ok: true,
      token,
      session: {
        ...session,
        apiTokenHash,
        status: "active"
      }
    };
  }

  public async findActiveAppSessionByToken(token: string): Promise<AppSessionRecord | null> {
    await this.appSessionsRepository.markExpired();

    const session = await this.appSessionsRepository.findActiveByTokenHash(hashSecret(token));
    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await this.appSessionsRepository.updateStatus(session.id, "expired");
      return null;
    }

    return session;
  }

  public async findTimeZone(telegramUserId: number): Promise<string | null> {
    return this.userSettingsRepository.findTimeZone(telegramUserId);
  }

  public async saveTimeZone(params: { telegramUserId: number; timeZone: string }): Promise<void> {
    if (!isValidTimeZone(params.timeZone)) {
      throw new Error(`Invalid time zone: ${params.timeZone}`);
    }

    await this.userSettingsRepository.upsertTimeZone({
      telegramUserId: params.telegramUserId,
      timeZone: params.timeZone
    });
  }

  public async createAutoTimeZoneLink(params: {
    telegramUserId: number;
    telegramChatId: number;
  }): Promise<CreateAutoTimeZoneLinkResult> {
    await this.settingsUpdateSessionsRepository.markExpired();

    const sid = randomUUID();
    const secret = generateOpaqueSecret();
    const expiresAt = new Date(Date.now() + SETTINGS_SESSION_TTL_MINUTES * 60 * 1000);

    await this.settingsUpdateSessionsRepository.create({
      id: sid,
      telegramUserId: params.telegramUserId,
      telegramChatId: params.telegramChatId,
      purpose: "time_zone_auto",
      sessionSecretHash: hashSecret(secret),
      expiresAt
    });

    const url = new URL("/settings/time-zone/auto", env.APP_BASE_URL);
    url.searchParams.set("sid", sid);
    url.searchParams.set("secret", secret);

    return { url: url.toString(), expiresAt };
  }

  public async completeAutoTimeZone(params: {
    sid: string;
    secret: string;
    timeZone: string;
  }): Promise<CompleteAutoTimeZoneResult> {
    await this.settingsUpdateSessionsRepository.markExpired();

    const session = await this.settingsUpdateSessionsRepository.findById(params.sid);
    if (!session) {
      return { ok: false, statusCode: 404, message: "Сессия настройки не найдена." };
    }

    if (session.status !== "pending") {
      return { ok: false, statusCode: 409, message: "Ссылка настройки уже использована." };
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await this.settingsUpdateSessionsRepository.updateStatus(session.id, "expired");
      return { ok: false, statusCode: 410, message: "Ссылка настройки истекла." };
    }

    if (!isSecretHashMatch({ secret: params.secret, hash: session.sessionSecretHash })) {
      return { ok: false, statusCode: 403, message: "Некорректная ссылка настройки." };
    }

    if (!isValidTimeZone(params.timeZone)) {
      return { ok: false, statusCode: 400, message: "Не удалось определить корректный часовой пояс." };
    }

    await this.userSettingsRepository.upsertTimeZone({
      telegramUserId: session.telegramUserId,
      timeZone: params.timeZone
    });
    await this.settingsUpdateSessionsRepository.updateStatus(session.id, "completed");
    await this.sendTelegramNotification({
      chatId: session.telegramChatId,
      text: `Часовой пояс сохранен: ${params.timeZone}.`
    });

    return { ok: true, message: "Часовой пояс сохранен. Можно вернуться в Telegram." };
  }

  private async sendTelegramNotification(params: { chatId: number; text: string }): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: params.chatId,
          text: params.text
        })
      });
    } catch (error) {
      const normalized = normalizeError(error);
      logger.warn(toLogPayload(normalized, { scope: "telegram", action: "sendSettingsNotification" }));
    }
  }
}
