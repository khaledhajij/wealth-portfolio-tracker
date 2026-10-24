import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { postgresConnectionOptions } from "./postgres-config";

// No connection at module import time; the static page needs no database.
export function createDatabaseClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required. Follow the database setup in README.md.");
  }

  const adapter = new PrismaPg(postgresConnectionOptions(connectionString));
  return new PrismaClient({ adapter });
}
