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
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "../generated/prisma/client";
import { createPortfolioService } from "../lib/server/portfolio-service";

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

async function createPortfolio(page: Page, name: string, holdRequest = false) {
  await page.getByRole("button", { name: "Create portfolio", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  const field = dialog.getByLabel("Portfolio name", { exact: true });
  await check(field).toBeFocused();
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(bounds && viewport && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
  await dialog.getByRole("button", { name: "Create portfolio", exact: true }).click();
  await check(field).toBeFocused(); // native required validation
  await field.fill("   ");
  await dialog.getByRole("button", { name: "Create portfolio", exact: true }).click();
  await check(dialog.getByRole("alert")).toBeFocused();
  await check(field).toHaveValue("   ");
  await check(field).toHaveAttribute("maxlength", "100");
  await field.fill(name);
  let release!: () => void;
  let intercepted!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const arrived = new Promise<void>((resolve) => { intercepted = resolve; });
  let count = 0;
  if (holdRequest) await page.route("**/api/portfolios", async (route) => {
    if (route.request().method() !== "POST") { await route.continue(); return; }
    count++; intercepted(); await gate; await route.continue();
  });
  const response = page.waitForResponse((res) => res.url() === `${origin}/api/portfolios` && res.request().method() === "POST");
  await dialog.getByRole("button", { name: "Create portfolio", exact: true }).click();
  if (holdRequest) {
    try {
      await arrived;
      await check(dialog.getByRole("button", { name: /^Saving/ })).toBeDisabled();
      await check(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
      await page.keyboard.press("Enter");
      assert.equal(count, 1);
    } finally { release(); }
  }
  const created = await response;
  assert.equal(created.status(), 201);
  const dto = await created.json() as { id: string; name: string; currency: string; role: string };
  assert.deepEqual(Object.keys(dto).sort(), ["currency", "id", "name", "role"]);
  assert.equal(dto.name, name.trim()); assert.equal(dto.currency, "USD"); assert.equal(dto.role, "OWNER");
  await check(page).toHaveURL(`${origin}/portfolios/${dto.id}`);
  if (holdRequest) await page.unroute("**/api/portfolios");
  await check(page.getByRole("heading", { name: name.trim(), exact: true })).toBeVisible();
  await check(page.getByTestId("portfolio-total")).toHaveText("$0.00");
  await check(page.getByRole("heading", { name: "A clear starting point" })).toBeVisible();
  await check(page.getByRole("heading", { name: "No movements recorded" })).toBeVisible();
  await check(page.locator(".allocation-list")).not.toContainText(/NaN|Infinity/);
  assert.equal(await db.membership.count({ where: { portfolioId: dto.id } }), 1);
  assert.equal(await db.position.count({ where: { portfolioId: dto.id } }), 0);
  assert.equal(await db.positionMovement.count({ where: { portfolioId: dto.id } }), 0);
  return dto;
}

async function verifyRollback(name: string) {
  // Fault injection is confined to this test: the real first INSERT runs, then
  // a real FK violation in the second INSERT must roll back the transaction.
  // This internal service probe is not an authentication substitute; HTTP cases
  // below use real Better Auth sessions and the unmodified production routes.
  let attempted = false;
  const failingDb = { $transaction: async (operation: (tx: unknown) => Promise<unknown>) => db.$transaction(async (tx) => {
    return operation({ portfolio: tx.portfolio, membership: { create: async (args: { data: { portfolioId: string } }) => {
      assert.equal(await tx.portfolio.count({ where: { id: args.data.portfolioId, name } }), 1);
      attempted = true;
      return tx.membership.create({ data: { portfolioId: args.data.portfolioId, userId: `absent:${randomUUID()}`, role: "OWNER" } });
    } } });
  }, { timeout: 30000 }) } as unknown as PrismaClient;
  const service = createPortfolioService(failingDb, async () => ({ id: "demo-owner" }));
  await assert.rejects(service.createPortfolio({ name }), (error: unknown) =>
    !!error && typeof error === "object" && "code" in error && error.code === "P2003");
  assert.equal(attempted, true);
  assert.equal(await db.portfolio.count({ where: { name } }), 0);
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
  stage = "anonymous portfolio creation and listing rejection";
  const anonymous = await browser.newContext(); contexts.push(anonymous);
  assert.equal((await anonymous.request.get(`${origin}/api/portfolios`)).status(), 401);
  assert.equal((await anonymous.request.post(`${origin}/api/portfolios`, { headers: { Origin: origin }, data: { name: "Denied anonymous" } })).status(), 401);
  const owner = await login("owner@example.invalid");
  const runId = randomUUID();
  const name = `[Synthetic verification] Dashboard ${runId.slice(-8)}`;
  stage = "portfolio validation, identity injection, and membership failure rollback";
  for (const data of [{}, { name: " " }, { name: 3 }, { name: "x".repeat(101) },
    ...["userId", "ownerId", "role", "currency"].map((key) => ({ name, [key]: "demo-other-owner" }))]) {
    assert.equal((await owner.request.post(`${origin}/api/portfolios`, { headers: { Origin: origin }, data })).status(), 400);
  }
  assert.equal(await db.portfolio.count({ where: { name } }), 0);
  await verifyRollback(`[Synthetic rollback] ${runId}`);
  stage = "Owner creates empty portfolio through real UI and pending guard";
  // A real service error is requested cross-origin: retain input and focus error.
  await owner.getByRole("button", { name: "Create portfolio", exact: true }).first().click();
  await owner.getByLabel("Portfolio name", { exact: true }).fill(name);
  await owner.route("**/api/portfolios", async (route) => {
    await route.continue({ headers: { ...route.request().headers(), origin: "https://untrusted.example.invalid" } });
  });
  const rejectedCreation = owner.waitForResponse((res) => res.url() === `${origin}/api/portfolios` && res.request().method() === "POST");
  await owner.getByRole("dialog").getByRole("button", { name: "Create portfolio", exact: true }).click();
  assert.equal((await rejectedCreation).status(), 403);
  await check(owner.getByRole("dialog").getByRole("alert")).toBeFocused();
  await check(owner.getByLabel("Portfolio name", { exact: true })).toHaveValue(name);
  await owner.unroute("**/api/portfolios");
  await owner.getByRole("button", { name: "Cancel", exact: true }).click();
  const { id } = await createPortfolio(owner, name, true);
  assert.equal(await db.portfolio.count({ where: { name } }), 1);
  assert.equal((await db.membership.findUniqueOrThrow({ where: { userId_portfolioId: { userId: "demo-owner", portfolioId: id } } })).role, "OWNER");
  await owner.goto(`${origin}/portfolios`);
  await check(owner.getByRole("link").filter({ has: owner.getByRole("heading", { name, exact: true }) })).toBeVisible();
  stage = "isolated synthetic collaborator fixtures for existing dashboard checks";
  await db.$transaction(async (tx) => {
    for (const [userId, role] of [["demo-editor", "EDITOR"], ["demo-viewer", "VIEWER"]] as const) {
      await tx.membership.create({ data: { userId, role, portfolioId: id } });
    }
  }, { timeout: 30000 });
  console.log("PASS: anonymous/invalid/injected requests denied; real FK membership failure rolls back portfolio; UI creates exactly one empty USD portfolio with session-derived Owner");
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
  stage = "Viewer creates own portfolio; portfolio-scoped roles and isolated lists";
  await viewer.goto(`${origin}/portfolios`);
  const own = await createPortfolio(viewer, `[Synthetic Viewer-owned] ${runId.slice(-8)}`);
  const viewerList = await (await viewer.request.get(`${origin}/api/portfolios`)).json() as { id: string; role: string }[];
  assert.equal(viewerList.find((row) => row.id === id)?.role, "VIEWER");
  assert.equal(viewerList.find((row) => row.id === own.id)?.role, "OWNER");
  const ownerList = await (await owner.request.get(`${origin}/api/portfolios`)).json() as { id: string }[];
  assert.equal(ownerList.some((row) => row.id === own.id), false);
  assert.equal((await owner.request.get(`${origin}/api/portfolios/${own.id}/summary`)).status(), 404);
  assert.equal((await viewer.request.get(`${origin}/api/portfolios/${own.id}/summary`)).status(), 200);
  stage = "fresh synthetic account, no-portfolios mobile creation journey";
  const freshId = `verify-ui-user:${runId}`;
  const freshEmail = `${runId}@example.invalid`;
  const password = await hashPassword(demoPassword());
  await db.$transaction(async (tx) => {
    await tx.user.create({ data: { id: freshId, name: "Synthetic UI verification", email: freshEmail } });
    await tx.account.create({ data: { id: `credential:${freshId}`, userId: freshId, accountId: freshId, providerId: "credential", password } });
  }, { timeout: 30000 });
  const fresh = await login(freshEmail, true);
  await check(fresh.getByRole("heading", { name: "No portfolios yet" })).toBeVisible();
  assert.deepEqual(await (await fresh.request.get(`${origin}/api/portfolios`)).json(), []);
  const freshPortfolio = await createPortfolio(fresh, `[Synthetic first portfolio] ${runId.slice(-8)}`);
  assert.equal(await fresh.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal((await owner.request.get(`${origin}/api/portfolios/${freshPortfolio.id}/summary`)).status(), 404);
  console.log("PASS: Viewer can own another portfolio; server-filtered lists/nonmember denial; fresh account empty list and mobile zero-value dashboard");
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
