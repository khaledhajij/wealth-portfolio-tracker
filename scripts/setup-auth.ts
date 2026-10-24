import nextEnv from "@next/env";
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";

nextEnv.loadEnvConfig(process.cwd());
// Local setup only. Preserve configured values; never print secrets or passwords.
const additions: string[] = [];
if (!process.env.BETTER_AUTH_SECRET) additions.push(`BETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}`);
if (!process.env.BETTER_AUTH_URL) additions.push("BETTER_AUTH_URL=http://localhost:3000");
if (!process.env.DEMO_ACCOUNT_PASSWORD) additions.push(`DEMO_ACCOUNT_PASSWORD=${randomBytes(24).toString("base64url")}`);
if (additions.length) appendFileSync(".env.local", `\n# Phase 3 local authentication (private)\n${additions.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
console.log(additions.length ? "Missing local auth settings generated in ignored .env.local. Existing settings preserved; values suppressed." : "Auth settings already configured; nothing changed.");
