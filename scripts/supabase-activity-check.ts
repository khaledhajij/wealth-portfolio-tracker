import { Client } from "pg";
import { postgresConnectionOptions } from "../lib/server/postgres-config";

// This is an availability/activity check, not a guarantee against Free-plan pausing.
// Use a dedicated PostgreSQL login with CONNECT, USAGE on public, and SELECT on Portfolio.
const connectionString = process.env.SUPABASE_ACTIVITY_DATABASE_URL;

if (!connectionString) {
  console.error("Missing GitHub Actions secret: SUPABASE_ACTIVITY_DATABASE_URL.");
  process.exitCode = 1;
} else {
  let client: Client | undefined;
  try {
    const host = new URL(connectionString).hostname;
    if (!host.endsWith(".supabase.co") && !host.endsWith(".supabase.com")) {
      throw new Error("Expected a Supabase database host.");
    }

    client = new Client({
      ...postgresConnectionOptions(connectionString),
      application_name: "wealth_portfolio_activity_check",
      statement_timeout: 10_000,
      query_timeout: 10_000,
    });

    await client.connect();
    await client.query("BEGIN READ ONLY");
    // A real application-table read; no rows, counts, or user data are logged.
    await client.query('SELECT 1 FROM public."Portfolio" LIMIT 1');
    await client.query("ROLLBACK");
    console.log("Supabase application-table read succeeded (read-only).");
  } catch (error) {
    // Do not leak URLs, passwords, SQL details, or driver errors into public CI logs.
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "unknown";
    console.error(`Supabase read-only check failed (code: ${code}).`);
    process.exitCode = 1;
  } finally {
    await client?.end().catch(() => {});
  }
}
