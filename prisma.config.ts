import nextEnv from "@next/env";
import { defineConfig } from "prisma/config";
import { prismaDatabaseUrl } from "./lib/server/postgres-config";

// Match Next.js's .env.local handling for CLI commands. Never log the URL.
nextEnv.loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --conditions=react-server --import tsx prisma/seed.ts",
  },
  // Generation/validation work without a database. Database commands require it.
  ...(process.env.DATABASE_URL
    ? { datasource: { url: prismaDatabaseUrl(process.env.DATABASE_URL) } }
    : {}),
});
