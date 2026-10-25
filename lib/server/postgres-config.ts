// Node-only configuration shared by Prisma CLI, pg and the server adapter.
// node:fs prevents this module from being bundled for the browser.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { X509Certificate } from "node:crypto";
import type { PoolConfig } from "pg";

function parseUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
    return url;
  } catch {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL URL; its value is suppressed.",
    );
  }
}

function databaseCa() {
  const configured = process.env.DATABASE_SSL_CA_FILE;
  if (!configured) return undefined;
  try {
    // Dynamically configured path: next.config.ts includes only the public CA.
    // Do not trace the entire workspace/local configuration into server output.
    const path = resolve(/* turbopackIgnore: true */ process.cwd(), configured);
    const pem = readFileSync(/* turbopackIgnore: true */ path, "utf8");
    if (!new X509Certificate(pem).ca) throw new Error();
    return { path, pem };
  } catch {
    throw new Error(
      "DATABASE_SSL_CA_FILE must point to a readable official PEM CA certificate.",
    );
  }
}

export function postgresConnectionOptions(value: string): PoolConfig {
  const url = parseUrl(value);
  const ca = databaseCa();
  if (ca) {
    // pg URL SSL parameters otherwise replace the explicit ssl object.
    for (const key of [
      "sslmode",
      "sslcert",
      "sslkey",
      "sslrootcert",
      "sslaccept",
    ])
      url.searchParams.delete(key);
    return {
      connectionString: url.toString(),
      ssl: { ca: ca.pem, rejectUnauthorized: true },
      connectionTimeoutMillis: 10000,
    };
  }
  if (
    (url.hostname.endsWith(".supabase.co") ||
      url.hostname.endsWith(".supabase.com")) &&
    !url.searchParams.has("sslmode")
  ) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return { connectionString: url.toString(), connectionTimeoutMillis: 10000 };
}

export function prismaDatabaseUrl(value: string) {
  const url = parseUrl(value);
  const ca = databaseCa();
  if (ca) {
    // Prisma's migration engine uses sslcert; pg uses the CA object above.
    url.searchParams.delete("sslrootcert");
    url.searchParams.set("sslcert", ca.path.replaceAll("\\", "/"));
    url.searchParams.set("sslmode", "require");
    url.searchParams.set("sslaccept", "strict");
  }
  return url.toString();
}
