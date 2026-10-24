import "server-only";
import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import type { PrismaClient } from "../../generated/prisma/client";
import { getDatabase } from "./db";
import { authSettings } from "./auth-settings";

export function createAuth(db: PrismaClient, env: NodeJS.ProcessEnv = process.env) {
  const settings = authSettings(env);
  return betterAuth({
    appName: "Wealth Portfolio Prototype",
    baseURL: settings.baseURL,
    secret: settings.secret,
    database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
    emailAndPassword: { enabled: true, disableSignUp: true, requireEmailVerification: false, minPasswordLength: 12 },
    session: { expiresIn: 60 * 60 * 8, disableSessionRefresh: true, cookieCache: { enabled: false } },
    advanced: {
      useSecureCookies: settings.secure,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: settings.secure, path: "/" },
      // Do not store request IP addresses for this synthetic prototype.
      ipAddress: { disableIpTracking: true },
    },
    trustedOrigins: [settings.baseURL],
    rateLimit: { enabled: true, window: 60, max: 30, storage: "memory" },
    logger: { disabled: true }, // Never forward raw adapter errors/connection metadata to logs.
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(getDatabase()); }
