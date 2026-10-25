import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../generated/prisma/client";
import { createAuth } from "../lib/server/auth";

const env = {
  NODE_ENV: "test",
  BETTER_AUTH_URL: "https://auth-review.example.invalid",
  BETTER_AUTH_SECRET: "synthetic-review-secret-at-least-32-characters",
} satisfies NodeJS.ProcessEnv;

test("actual auth handler limits repeated invalid sign-ins before database access", async () => {
  const auth = createAuth({} as PrismaClient, env);
  const statuses = [];
  for (let index = 0; index < 11; index++) {
    const response = await auth.handler(
      new Request(`${env.BETTER_AUTH_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: env.BETTER_AUTH_URL,
        },
        body: "{}",
      }),
    );
    statuses.push(response.status);
    if (response.status === 429)
      assert.ok(Number(response.headers.get("x-retry-after")) > 0);
  }
  assert.deepEqual(statuses, [...Array(10).fill(400), 429]);
  // Untrusted forwarding headers must not create a fresh bucket off Vercel.
  const spoofed = await auth.handler(
    new Request(`${env.BETTER_AUTH_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: env.BETTER_AUTH_URL,
        "x-forwarded-for": "192.0.2.99",
        "x-vercel-forwarded-for": "192.0.2.100",
      },
      body: "{}",
    }),
  );
  assert.equal(spoofed.status, 429);
});

test("session persistence removes the address while the library limiter remains enabled", async () => {
  let saved: Record<string, unknown> | undefined;
  const db = {
    session: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        saved = data;
        return data;
      },
    },
  } as unknown as PrismaClient;
  const auth = createAuth(db, env);
  const context = await auth.$context;
  await context.internalAdapter.createSession("synthetic-review-user", false, {
    ipAddress: "192.0.2.42",
  });
  assert.ok(saved);
  assert.equal(saved.ipAddress, null);
  assert.equal(auth.options.advanced?.ipAddress?.disableIpTracking, false);
  assert.deepEqual(auth.options.advanced?.ipAddress?.ipAddressHeaders, []);
  const vercel = createAuth({} as PrismaClient, { ...env, VERCEL: "1" });
  assert.deepEqual(vercel.options.advanced?.ipAddress?.ipAddressHeaders, [
    "x-vercel-forwarded-for",
  ]);
});
