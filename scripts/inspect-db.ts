import nextEnv from "@next/env";
import { Client } from "pg";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { postgresConnectionOptions } from "../lib/server/postgres-config";

nextEnv.loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is missing; no connection attempted.");
let url: URL;
try { url = new URL(connectionString); } catch {
  throw new Error("DATABASE_URL is malformed; its value is suppressed.");
}
if (!url.hostname.endsWith(".supabase.co") && !url.hostname.endsWith(".supabase.com")) {
  throw new Error("Expected a Supabase database host; review the local configuration.");
}
const client = new Client({ ...postgresConnectionOptions(connectionString), statement_timeout: 10000 });
console.log(JSON.stringify({ configured: true, provider: "Supabase", mode: url.hostname.includes("pooler") ? `pooler:${url.port || "5432"}` : "direct" }));
try {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  const version = await client.query("SHOW server_version");
  const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  console.log(JSON.stringify({ connected: true, provider: "Supabase", mode: url.hostname.includes("pooler") ? `pooler:${url.port || "5432"}` : "direct", serverVersion: version.rows[0].server_version, publicTables: tables.rows.map((row) => row.tablename) }));
  if (tables.rows.some((row) => row.tablename === "_prisma_migrations")) {
    const migrations = await client.query('SELECT migration_name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM public."_prisma_migrations" ORDER BY started_at');
    console.log("Migration history:", JSON.stringify(migrations.rows.map((row) => {
      const path = `prisma/migrations/${row.migration_name}/migration.sql`;
      let matchesLocal = false;
      try { matchesLocal = createHash("sha256").update(readFileSync(path)).digest("hex") === row.checksum; } catch { /* Unknown migration is reported without touching it. */ }
      return { name: row.migration_name, finished: row.finished, rolledBack: row.rolled_back, matchesLocal };
    })));
  } else console.log("No Prisma migration history table exists.");
  console.log("Local migrations:", readdirSync("prisma/migrations").filter((name) => !name.endsWith(".toml")));
  await client.query("ROLLBACK");
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  const message = error instanceof Error ? error.message : "";
  const category = /timeout|timed out|terminated/i.test(message) ? "connection-timeout-or-termination"
    : /certificate|ssl|tls/i.test(message) ? "TLS" : "connection-or-query";
  console.error(`Database inspection failed (${code}, ${category}); connection details suppressed.`);
  process.exitCode = 1;
} finally {
  await client.end();
}
