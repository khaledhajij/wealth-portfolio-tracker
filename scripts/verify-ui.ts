import nextEnv from "@next/env";
import assert from "node:assert/strict";
import { chromium, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createDatabaseClient } from "../lib/server/db";
import { demoPassword } from "../prisma/seed-auth";

nextEnv.loadEnvConfig(process.cwd());
const check = expect.configure({ timeout: 20000 });
let stage = "read-only migration preflight";
let server: ChildProcess | undefined;
let browser: Browser | undefined;
let origin = "";
const contexts: BrowserContext[] = [];
const db = createDatabaseClient();

async function launchServer() {
  assert.ok(existsSync(".next/BUILD_ID"), "Run npm run build first");
  const probe = createServer();
  await new Promise<void>((resolve, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", resolve); });
  const address = probe.address(); assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  origin = `http://127.0.0.1:${address.port}`;
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(address.port)], {
    env: { ...process.env, NODE_ENV: "production", BETTER_AUTH_URL: origin }, stdio: "ignore", windowsHide: true,
  });
  let failed = false; server.once("error", () => { failed = true; });
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.ok(!failed && server.exitCode === null, "Verification server failed to start");
    try { if ((await fetch(`${origin}/sign-in`, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* Await startup. */ }
    await delay(150);
  }
  throw new Error("Verification server startup timeout");
}
async function login(email: string, mobile = false) {
  const context = await browser!.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto(`${origin}/sign-in`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(demoPassword());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await check(page).toHaveURL(`${origin}/portfolios`);
  return page;
}
async function createPosition(page: Page, name: string, symbol: string, price: string, type = "STOCK", releasePending?: () => void) {
  await page.getByRole("button", { name: "Add position", exact: true }).first().click();
  const dialog = page.getByRole("dialog"); await check(dialog).toBeVisible();
  await check(dialog.getByLabel("Asset type")).toBeFocused();
  await dialog.getByLabel("Asset type").selectOption(type);
  await dialog.getByLabel("Position name").fill(name);
  if (type === "CASH") {
    await check(dialog.getByLabel("Symbol")).toHaveValue("USD");
    await check(dialog.getByLabel("Fixed unit price (USD)")).toHaveAttribute("readonly", "");
  } else {
    await dialog.getByLabel("Symbol").fill(symbol);
    await dialog.getByLabel("Manual unit price (USD)").fill(price);
  }
  await dialog.getByRole("button", { name: "Create position", exact: true }).click();
  if (releasePending) {
    try { await check(dialog.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled(); }
    finally { releasePending(); }
  }
  await check(dialog).not.toBeVisible();
  await check(page.locator(".asset-cell").filter({ hasText: name })).toBeVisible();
}
async function movement(page: Page, symbol: string, quantity: string, decrease = false) {
  await page.getByRole("button", { name: `Record movement for ${symbol}`, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Direction").selectOption(decrease ? "DECREASE" : "INCREASE");
  await dialog.getByLabel("Quantity", { exact: true }).fill(quantity);
  await dialog.getByRole("button", { name: "Record movement", exact: true }).click();
  return dialog;
}

try {
  const local = readdirSync("prisma/migrations").filter((name) => !name.endsWith(".toml"));
  const history = await db.$queryRaw<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`
    SELECT migration_name, checksum, finished_at, rolled_back_at FROM public."_prisma_migrations" ORDER BY started_at`;
  assert.equal(history.length, local.length);
  for (const name of local) {
    const row = history.find((entry) => entry.migration_name === name);
    assert.ok(row?.finished_at && !row.rolled_back_at);
    assert.equal(row.checksum, createHash("sha256").update(readFileSync(`prisma/migrations/${name}/migration.sql`)).digest("hex"));
  }
  stage = "local server and real browser login";
  await launchServer();
  const channel = process.env.PLAYWRIGHT_CHANNEL || (!existsSync(chromium.executablePath()) && process.platform === "win32" && existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe") ? "chrome" : undefined);
  browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  const owner = await login("owner@example.invalid");
  const id = `verify-ui:${randomUUID()}`;
  const name = `[Synthetic verification] Dashboard ${id.slice(-8)}`;
  stage = "isolated synthetic portfolio fixture";
  await db.$transaction(async (tx) => {
    await tx.portfolio.create({ data: { id, name } });
    for (const [userId, role] of [["demo-owner", "OWNER"], ["demo-editor", "EDITOR"], ["demo-viewer", "VIEWER"]] as const) {
      await tx.membership.create({ data: { userId, role, portfolioId: id } });
    }
  }, { timeout: 30000 });
  const url = `${origin}/portfolios/${encodeURIComponent(id)}`;
  stage = "Owner empty state, native validation and pending controls";
  await owner.goto(url);
  await check(owner.getByRole("heading", { name, exact: true })).toBeVisible();
  await check(owner.getByTestId("portfolio-total")).toHaveText("$0.00");
  await check(owner.getByRole("heading", { name: "A clear starting point" })).toBeVisible();
  await owner.getByRole("button", { name: "Add position", exact: true }).first().click();
  await owner.getByRole("button", { name: "Create position", exact: true }).click();
  await check(owner.getByLabel("Position name")).toBeFocused();
  await owner.keyboard.press("Escape");
  await check(owner.getByRole("button", { name: "Add position", exact: true }).first()).toBeFocused();
  // Hold a real request until pending UI is checked; never mock success.
  let releasePending!: () => void;
  const pendingRequest = new Promise<void>((resolve) => { releasePending = resolve; });
  await owner.route("**/api/portfolios/*/positions", async (route) => { await pendingRequest; await route.continue(); });
  await createPosition(owner, "UI stock", "UITEST", "50", "STOCK", releasePending);
  await owner.unroute("**/api/portfolios/*/positions");
  stage = "server form rejection and focus";
  let dialog = await movement(owner, "UITEST", "0");
  await check(dialog.getByRole("alert")).toBeVisible(); await check(dialog.getByRole("alert")).toBeFocused();
  await dialog.getByLabel("Quantity", { exact: true }).fill("10");
  await dialog.getByRole("button", { name: "Record movement", exact: true }).click();
  await check(dialog).not.toBeVisible();
  await check(owner.getByTestId("portfolio-total")).toHaveText("$500.00");
  await createPosition(owner, "UI cash", "USD", "1", "CASH");
  dialog = await movement(owner, "USD", "100"); await check(dialog).not.toBeVisible();
  await check(owner.getByTestId("portfolio-total")).toHaveText("$600.00");
  dialog = await movement(owner, "UITEST", "2"); await check(dialog).not.toBeVisible();
  await check(owner.getByTestId("portfolio-total")).toHaveText("$700.00");
  stage = "manual price refresh, history and insufficient balance";
  await owner.getByRole("button", { name: "Update price for UITEST", exact: true }).click();
  dialog = owner.getByRole("dialog");
  await dialog.getByLabel("Manual unit price (USD)").fill("60");
  await dialog.getByRole("button", { name: "Save price", exact: true }).click();
  await check(dialog).not.toBeVisible();
  await check(owner.getByTestId("portfolio-total")).toHaveText("$820.00");
  await check(owner.locator(".history-list li")).toHaveCount(3);
  dialog = await movement(owner, "UITEST", "13", true);
  await check(dialog.getByRole("alert")).toContainText("cannot be negative");
  await check(dialog.getByRole("alert")).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await check(owner.getByRole("button", { name: "Record movement for UITEST", exact: true })).toBeFocused();
  console.log("PASS: Owner journey, empty/native/server validation, 600 -> 700, price refresh to 820, history and focus restoration");

  stage = "Editor mobile layout and form";
  const editor = await login("editor@example.invalid", true); await editor.goto(url);
  assert.equal(await editor.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await createPosition(editor, "UI crypto", "UIFRAC", "0.1", "CRYPTO");
  dialog = await movement(editor, "UIFRAC", "0.1"); await check(dialog).not.toBeVisible();
  await check(editor.getByTestId("portfolio-total")).toHaveText("$820.01");
  assert.equal(await editor.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await editor.getByRole("button", { name: "Update price for UIFRAC", exact: true }).click();
  const bounds = await editor.getByRole("dialog").boundingBox(); assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390);
  await editor.keyboard.press("Escape");
  mkdirSync(".playwright-mcp", { recursive: true });
  await editor.screenshot({ path: ".playwright-mcp/dashboard-mobile.png", fullPage: true });
  console.log("PASS: Editor real writes, 390px touch layout, fractional values and contained dialog/table overflow");

  stage = "Viewer UX and direct write denial";
  const viewer = await login("viewer@example.invalid"); await viewer.goto(url);
  await check(viewer.getByText("View-only access.", { exact: false })).toBeVisible();
  await check(viewer.getByRole("button", { name: "Add position", exact: true })).toHaveCount(0);
  await check(viewer.getByRole("button", { name: /^Record movement for/ })).toHaveCount(0);
  await check(viewer.getByRole("button", { name: /^Update price for/ })).toHaveCount(0);
  const denied = await viewer.request.post(`${origin}/api/portfolios/${id}/positions`, { headers: { Origin: origin, "x-role": "OWNER" }, data: { assetType: "STOCK", label: "Denied", symbol: "DENIED", unitPrice: "1", priceAsOf: new Date().toISOString() } });
  assert.equal(denied.status(), 403);
  await viewer.screenshot({ path: ".playwright-mcp/dashboard-viewer.png", fullPage: true });
  stage = "nonmember and logout";
  const other = await login("other@example.invalid"); await other.goto(url);
  await check(other.getByRole("heading", { name: "This portfolio isn’t available." })).toBeVisible();
  await owner.getByRole("button", { name: "Sign out", exact: true }).click();
  await check(owner).toHaveURL(`${origin}/sign-in`);
  await owner.goto(url); await check(owner).toHaveURL(`${origin}/sign-in`);
  console.log("PASS: Viewer read-only controls plus server 403, nonmember denial and logout redirect");
  console.log("Synthetic UI verification portfolio/history retained; no existing holdings were reset or deleted.");
} catch {
  console.error(`Dashboard verification failed at ${stage}; secrets suppressed. Check database/setup and the documented browser prerequisites.`);
  process.exitCode = 1;
} finally {
  for (const context of contexts) {
    try { await context.request.post(`${origin}/api/auth/sign-out`, { headers: { Origin: origin }, data: {}, timeout: 5000 }); } catch { /* Revoke only this run's sessions where possible. */ }
    await context.close();
  }
  await browser?.close(); server?.kill(); await db.$disconnect();
}
