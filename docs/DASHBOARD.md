# Phase 5 dashboard

Phase 6 adds a read-only assistant, now opened with the bottom-right **Ask AI** launcher. A separate Client Component is keyed by the validated portfolio ID, receives the actual portfolio name/public availability settings, and stops/clears on portfolio change. Its native popup shows real SDK messages/tool source cards, supports Escape/Close/focus return and bounded mobile scrolling; closing cancels pending work but retains local messages for reopening. Missing key/model disables sending. Existing financial forms and server reads remain unchanged. Setup, security, limits and evidence: [ASSISTANT](ASSISTANT.md).

Phase 5.5 extends this dashboard with creation from the portfolio list (including no-portfolios state). A labeled 1-100 character name form reuses the native dialog/pending/error/focus provider. USD and Owner identity are server-derived; success refreshes accessible data and navigates to the new empty detail. Creation is offered regardless of roles in other portfolios. Ambiguous network results ask the user to refresh the list before retrying. No seeded positions/movements are added. List presentation is extracted to list-view.tsx; session-bound initial reads stay in page.tsx. Current local/component versus real database verification is recorded separately in STATUS.

## Implemented experience

English-only prototype at `/portfolios` and `/portfolios/:portfolioId`. Sign-in now opens the portfolio list; `/account` remains available with a dashboard link. No multilingual support, AI, market feed, trade execution or P&L was added.

The interface uses warm off-white surfaces, restrained green/sage/sand asset colors, system sans-serif text and local Georgia headings. It requires no external fonts/images/chart service. Desktop navigation becomes a compact mobile header. The positions table scrolls within a labeled, keyboard-focusable region on narrow screens; the page itself should not scroll horizontally. Numeric text preserves decimal strings, including tiny/large values.

The list reads only the user's memberships. Detail shows the actual portfolio name/current role, total USD value, allocation by STOCK/CRYPTO/CASH, movement-derived quantities, manual unit prices, values and explicit UTC price timestamps. Cash is labeled fixed at USD 1. The latest 100 portfolio movements show asset, increase/decrease, signed quantity, occurredAt and optional note. Empty states explain the next available step without inserting balances or positions.

## Data and interaction flow

1. Dynamic Server Components call the existing session-bound `portfolios()` services directly, not internal HTTP. Layout is presentation only; each service still authenticates and authorizes independently.
2. `getPortfolio` supplies positions and one Decimal valuation. `calculateValuation` now also groups the **same unrounded position values** into allocationByAssetType. Summary API inherits this additive field. No browser financial arithmetic or separate totals state is introduced.
3. New server-only `listPortfolioMovements` checks membership, constrains portfolioId and selects at most 100 rows with minimal asset metadata. It avoids an N+1 request per position. Portfolio detail reads valuation/history concurrently. No shared private-data cache.
4. The Client `PortfolioActions` provider owns only dialog/notice/pending state. Row controls receive minimal editable metadata, not the whole valuation/history. Its forms POST/PATCH the existing phase 4 Route Handlers. Owner/Editor controls are visible; Viewer sees a read-only explanation. Backend authorization is unchanged.
5. On success the dialog closes, an accessible success message appears, and `router.refresh()` asks Server Components for updated records/totals/history. A transition displays refresh progress and disables further mutations until it settles. No optimistic quantity/cash update or market claim.

## Forms and states

- Add position: asset type, label, symbol, manual unit price. The server sets the price recording time when saved; no date input. CASH uses readonly USD/1 fields. A new position starts with quantity zero; opening quantity is a separate movement.
- Record movement: direction selector plus positive quantity (works with mobile decimal keyboards), optional note and an automatic server UTC recording timestamp; no date input. The submitted signed string uses the selected direction. Cash does not change when recording another asset. The server rejects zero/overdraw/invalid amounts.
- Update price: current unit price with an automatic server UTC recording timestamp. Cash's fixed price has no price-edit control. Quantity is never edited by this form.
- Initial data: loading.tsx renders placeholders explicitly labeled loading. Missing session redirects to sign-in; absent/inaccessible portfolio uses a generic not-found view. Unexpected data failures show a retry boundary, never fake zero totals. Driver details are sanitized before reaching that boundary.
- Native required/pattern validation focuses invalid inputs. Server/network errors keep entered details and focus an alert. Modal uses native dialog focus containment/Escape and restores the opening control on cancel. Dialog/fields/submit are disabled during submission; the button says Saving. Successful notices receive focus after refresh. Automatic-time hints explain that UTC recording timestamps are assigned by the server on save; no datetime-local controls remain. Historical timestamps are preserved.
- Movement requestKey is generated per form payload and retained across unchanged retries, including connection interruptions. A synchronous ref blocks double submits before React updates disabled state. Changed input creates a new operation key; interrupted-outcome text asks users to check history before changing an adjustment. Reopening the dialog starts a new operation; inspect history first after an ambiguous network outcome.

## Verification

`npm test`: 35 passed, none skipped (valuation/authorization plus asset-type allocation and exact decimal/UTC formatting). Existing server write/concurrency tests remain. DB/session doubles are explicitly test-only.

`npm run typecheck`, `npm run lint`, `npm run build`, `npm ls --depth=0`: passed in this phase. Build includes dynamic portfolio list/detail. Installed dev-only `@playwright/test` **1.64.1**, exact-pinned with three added packages; no runtime UI/state/chart library. Existing pending install-script warnings remain, no extra script approvals. Initial duplicate additions were caught by TypeScript and removed. Generated ignored preview bundles initially entered ESLint; tmp/QA paths are now explicitly ignored, and lint passes. Baseline server-file line endings preserved.

The agent's actual Supabase inspection still times out. `npm run test:ui` stops at **read-only migration preflight**, before launching a test server/browser or creating fixtures. Successful authenticated dashboard reads/form commits/refreshes and real role/mobile journeys have **not** been verified by the agent. Prior phase 4 user-run HTTP/concurrency passes remain historical evidence; they are not a passing phase 5 UI run.

An isolated, ignored `tmp/ui-preview` harness bundled the actual dashboard/layout/form components using esbuild already available locally. It displayed a prominent TEST ONLY synthetic-data/no-database/router-stub notice; it was not an application route, identity flow or database fallback. Controlled 400 responses tested UI error/pending behavior only. Desktop 1440px and mobile 390px component checks covered visual layout, manual values, empty state, Viewer control absence, modal initial/error/return focus, retained inputs, pending disabled controls and identical movement keys on unchanged retries. Initial mobile overflow caused by an offscreen accessible table header was corrected by making its scroll container a positioning context; final component checks show no page overflow and contained dialogs. Screenshots live only in ignored .playwright-mcp. This is not live integration or a Safari/accessibility audit. The preview helper was stopped by its verified PID after Ctrl+C left it running; a second bind attempt had reported EADDRINUSE without starting another server.

Actual production application negative-path browser checks are recorded separately in STATUS. They do not substitute for authenticated portfolio tests. Final browser bundles are scanned for configured server-secret values; see STATUS for the actual count/result.

## Real browser verification from a connected terminal

Ensure existing migrations/demo credentials work as documented in README/AUTH. Phase 5 needs no new migration or password reset.

```powershell
npm ci
npm run build
npm run test:ui
```

The script uses Playwright Chromium if installed. On Windows, if bundled Chromium is missing and Chrome exists at the standard Program Files location, it uses installed Chrome. Otherwise install the matching browser with `npx playwright install chromium`. Optional `PLAYWRIGHT_CHANNEL=chrome` selects Chrome explicitly. Node 24/npm 11 prerequisites remain unchanged.

`test:ui` first checks migration history/checksums, then starts its own production server on a free loopback port. It signs in through the **real** form and creates a new labeled synthetic portfolio through the creation UI, verifies its sole Owner membership, then adds Editor/Viewer memberships only to this new fixture for the earlier dashboard checks. It also checks real FK failure rollback, denied anonymous/invalid/injected requests, isolated lists, a Viewer creating their own portfolio, and a fresh synthetic hashed-credential account with an empty list. No existing portfolio is reset and no password values, session cookies or connection strings are logged. It additionally verifies:

- Owner list/detail/empty state, native missing-field focus, real pending request lock, add-position/opening movements/cash, 600 -> 700 after +2 units, manual price refresh to 820, history and overdraw error focus/cancel restoration.
- Editor writes/fractional holdings at a 390px touch viewport, table/page overflow and dialog containment.
- Viewer controls absent while a direct forged-role write is still rejected by the server, nonmember portfolio denial, logout and protected-page redirect.

The pending check pauses a real request until disabled UI is asserted, then forwards it; it never mocks successful database responses. Financial verification fixtures/history remain as synthetic audit records, including partial fixtures after a later failure. Only test-created sessions are signed out; only its own server/browser are stopped. No tracing/password dumps. UI screenshots go to ignored .playwright-mcp.

Phase 5 remains awaiting live UI acceptance until that run passes. Do not advance to AI automatically. Existing auth rate-limit/rememberMe and runtime DB privilege/Data API limitations remain in AUTH/STATUS; this phase does not change auth behavior.

Official references consulted: [Next.js 16 refresh](https://nextjs.org/docs/app/api-reference/functions/use-router), [loading boundaries](https://nextjs.org/docs/app/api-reference/file-conventions/loading), [React 19.3 transitions](https://react.dev/reference/react/useTransition), [Playwright library](https://playwright.dev/docs/library), [locators](https://playwright.dev/docs/api/class-locator) and [web-first assertions](https://playwright.dev/docs/test-assertions). React/Next and local-only Sites skill guidance was applied; no Sites registration or deployment.
