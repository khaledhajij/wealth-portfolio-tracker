import "server-only";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import type { PrismaClient } from "../generated/prisma/client";
import { seedUsers } from "./seed-data";

export function demoPassword() {
  const value = process.env.DEMO_ACCOUNT_PASSWORD;
  if (!value || value.length < 12 || value.length > 128)
    throw new Error(
      "Set private DEMO_ACCOUNT_PASSWORD (12-128 characters) before seeding credentials.",
    );
  return value;
}

export async function seedDemoCredentials(db: PrismaClient, password: string) {
  // One private demo password, independent salted hashes. Never overwrite passwords.
  const hashes = await Promise.all(seedUsers.map(() => hashPassword(password)));
  await db.$transaction(
    async (tx) => {
      for (const [index, user] of seedUsers.entries()) {
        const identity = await tx.user.findUnique({ where: { id: user.id } });
        if (!identity || identity.email !== user.email)
          throw new Error(
            "Synthetic user identity conflict; credentials not seeded.",
          );
        const existing = await tx.account.findUnique({
          where: {
            providerId_accountId: {
              providerId: "credential",
              accountId: user.id,
            },
          },
        });
        if (existing) {
          if (
            existing.userId !== user.id ||
            !existing.password ||
            !(await verifyPassword({ hash: existing.password, password }))
          ) {
            throw new Error(
              "Existing demo credentials differ; seed will not reset them.",
            );
          }
        } else {
          await tx.account.create({
            data: {
              id: `credential:${user.id}`,
              accountId: user.id,
              providerId: "credential",
              userId: user.id,
              password: hashes[index],
            },
          });
        }
      }
    },
    { timeout: 30000 },
  );
}
