import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import { validateTelegramInitData } from "../../src/security/telegram-init-data.ts";

const BOT_TOKEN = "123456:test-token";
const NOW = new Date("2026-05-06T12:00:00.000Z");

test("validates signed Telegram initData", () => {
  const initData = createSignedInitData({
    authDate: Math.floor(NOW.getTime() / 1000),
    user: { id: 42, first_name: "Ada", username: "ada" }
  });

  const result = validateTelegramInitData({ initData, botToken: BOT_TOKEN, now: NOW });

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.user.id, 42);
  assert.equal(result.ok && result.user.firstName, "Ada");
  assert.equal(result.ok && result.user.username, "ada");
});

test("rejects initData without hash", () => {
  const result = validateTelegramInitData({
    initData: "auth_date=1778068800&user=%7B%22id%22%3A42%7D",
    botToken: BOT_TOKEN,
    now: NOW
  });

  assert.equal(result.ok, false);
});

test("rejects tampered initData", () => {
  const initData = createSignedInitData({
    authDate: Math.floor(NOW.getTime() / 1000),
    user: { id: 42 }
  }).replace("%7B%22id%22%3A42%7D", "%7B%22id%22%3A43%7D");

  const result = validateTelegramInitData({ initData, botToken: BOT_TOKEN, now: NOW });

  assert.equal(result.ok, false);
});

test("rejects expired auth_date", () => {
  const initData = createSignedInitData({
    authDate: Math.floor(NOW.getTime() / 1000) - 8 * 24 * 60 * 60,
    user: { id: 42 }
  });

  const result = validateTelegramInitData({ initData, botToken: BOT_TOKEN, now: NOW });

  assert.equal(result.ok, false);
});

test("rejects malformed user JSON", () => {
  const initData = createSignedInitData({
    authDate: Math.floor(NOW.getTime() / 1000),
    userRaw: "{bad-json"
  });

  const result = validateTelegramInitData({ initData, botToken: BOT_TOKEN, now: NOW });

  assert.equal(result.ok, false);
});

function createSignedInitData(params: {
  authDate: number;
  user?: Record<string, unknown>;
  userRaw?: string;
}): string {
  const searchParams = new URLSearchParams();
  searchParams.set("auth_date", String(params.authDate));
  searchParams.set("query_id", "AAHdF6IQAAAAAN0XohDhrOrc");
  searchParams.set("user", params.userRaw ?? JSON.stringify(params.user));

  const dataCheckString = Array.from(searchParams.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  searchParams.set("hash", hash);

  return searchParams.toString();
}
