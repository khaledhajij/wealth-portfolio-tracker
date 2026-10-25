import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { postgresConnectionOptions } from "./postgres-config";

// No connection at module import time; the static page needs no database.
export function createDatabaseClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required. Follow the database setup in README.md.",
    );
  }

  const adapter = new PrismaPg(postgresConnectionOptions(connectionString));
  return new PrismaClient({ adapter });
}

// Reuse connections across requests/hot reloads, never cache private query results.
const databaseGlobal = globalThis as typeof globalThis & {
  portfolioDatabase?: PrismaClient;
};
export function getDatabase() {
  return (databaseGlobal.portfolioDatabase ??= createDatabaseClient());
}
