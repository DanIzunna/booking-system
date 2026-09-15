import { createHash, randomBytes } from "crypto";
import {
  DEFAULT_ACCESS_TOKEN_EXPIRES_SECONDS,
  DEFAULT_REFRESH_TOKEN_EXPIRES_SECONDS,
} from "./auth.constants";

export function getAccessTokenSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_ACCESS_SECRET is required in production");
  }

  return "development-access-secret-not-for-production";
}

export function getAccessTokenExpiresSeconds(): number {
  return parseDuration(
    process.env.JWT_ACCESS_EXPIRES_IN,
    DEFAULT_ACCESS_TOKEN_EXPIRES_SECONDS,
  );
}

export function getRefreshTokenExpiresSeconds(): number {
  return parseDuration(
    process.env.JWT_REFRESH_EXPIRES_IN,
    DEFAULT_REFRESH_TOKEN_EXPIRES_SECONDS,
  );
}

export function createRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseDuration(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const match = value.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) {
    return fallback;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = { s: 1, m: 60, h: 60 * 60, d: 24 * 60 * 60 }[unit];

  return multiplier ? amount * multiplier : fallback;
}
