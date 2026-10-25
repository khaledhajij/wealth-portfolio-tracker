# Walkthrough preparation: 13 minutes

Prepared 2026-10-25 from current code and recorded evidence. This is an outline, not a completed recording or a claim that the author rehearsed/reviewed every file. Target 12–14 minutes; the schedule below totals 13:00. The original assessment's phase 0 record requests a voiced 10–15 minute screen recording.

## Rehearsal gate: demonstrate only what actually works

Before recording, run the documented setup and current checks from a working database-connected terminal. Confirm real sign-in, permissions and the selected synthetic journey yourself. Update results only after observing them. The user now confirms database and live Gemini operation and completed Vercel deployment (2026-10-25). Use the actual working application for the walkthrough. The agent’s earlier preflight failures and mock-based tests remain historical evidence; no detailed acceptance rerun or recording rehearsal is inferred from the user’s statement.

- If sign-in/database works during rehearsal, use the real app with synthetic accounts and a new clearly named synthetic portfolio.
- If it remains blocked, explain the failure and show actual code/unit-test results in those time slots. Do not present a component fixture, screenshot or controlled SSE as a live application/provider success.
- If Google is unavailable/unconfigured, show the actual disabled/error state only if accessible, otherwise its code/test. Explain the streaming implementation and controlled tests; do not claim a live response.
- Do not show .env.local, credentials, cookies, auth payloads, account hashes, provider headers or raw database logs. Close unrelated personal tabs and notifications.

## Timed screen-and-voice plan

| Time        | Show                                                                                                                                                    | Explain accurately                                                                                                                                                                                                                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–1:00   | PLAN scope and current STATUS summary                                                                                                                   | Holdings tracker: stock/crypto/cash, USD, manual prices; one application; understanding/security over implementing every candidate capability. Not trade execution/P&L. Distinguish user-confirmed operation/deployment from pending clean-DB/security/provider edge-case verification.                                                                                                           |
| 1:00–2:10   | If rehearsed successfully: real sign-in and accessible portfolio list. Otherwise auth/service code and passing tests.                                   | Seeded synthetic accounts, trusted library session, portfolio-scoped Owner/Editor/Viewer. Same owner account is Owner in seeded A and Viewer in B. Never a role switcher.                                                                                                                                                                                                                         |
| 2:10–4:40   | If available: create a new synthetic portfolio, empty state, stock/cash positions, movements and price update. Otherwise actual valuation tests/source. | New creation is empty and atomically adds Owner. Add stock 10 at $50 and cash 100 at $1: $600. Append stock +2: $700, cash unchanged. Set stock price $60: $820, quantity stays 12. UTC time is server recording time. Show history and no editable balance/date.                                                                                                                                 |
| 4:40–5:40   | Seeded B as owner@example.invalid's Viewer role, or Viewer unit/HTTP tests if blocked.                                                                  | Viewer reads but cannot mutate B. Do not expect Viewer access to the newly created Owner-only portfolio. Hidden controls improve UX; server denial is the security boundary. A nonmember ID is generic 404.                                                                                                                                                                                       |
| 5:40–7:40   | assistant.ts, assistant-tools.ts, chat contracts and popup. Live response only after an actual successful rehearsal.                                    | Google Gemini via direct Vercel AI SDK adapter; validated selected context before provider contact; summary/positions tools with empty model inputs; secured services rechecked. Exact numbers/time source cards; stream/Stop/errors; missing-key disablement. Clearly label controlled-test evidence.                                                                                            |
| 7:40–9:30   | session.ts -> portfolios.ts -> service; contracts and transaction code                                                                                  | Client portfolio IDs are requests, not authority. Derive user from session; scope position IDs to portfolio; reject role/user/time overrides. Serializable transaction + locks + balance check + retry; unique requestKey prevents duplicate movements and preserves original timestamp. Distinguish source/unit proof from earlier user SQL concurrency output.                                  |
| 9:30–10:40  | schema, valuation and dashboard data flow                                                                                                               | Prisma/SQL constraints, Decimal strings, no floating-point money, server-calculated total/allocation, Server Component initial reads and Client dialogs with refresh. One app is enough; no Express/Redis/global state library. Note large-data and manual-price trade-offs.                                                                                                                      |
| 10:40–11:45 | AI_USAGE and selected test files                                                                                                                        | Coding-agent assistance actually used for design options, library/source research, code/docs and tests/debugging. User set scope, configured Supabase, supplied logs and terminal API PASS evidence. No invented independent reviewer or claim of personally writing/reviewing every line. Explain what you now understand; flag what you cannot yet explain.                                     |
| 11:45–13:00 | STATUS table and delivery checklist                                                                                                                     | 54 unit/SDK tests + static/build passed in phase 7; agent integrations failed at preflight; user now confirms database/Gemini operation and Vercel deployment. Three verification risks: clean/current SQL acceptance; runtime privileges/origin/process-local abuse controls; provider failure/limit behavior and answer accuracy. Show honest deferred list and verified submission links only. |

Suggested short English framing: “This tracks recorded holdings using manual USD prices. The services enforce identity and portfolio membership. The assistant has the same read boundary and no mutation capability. I will distinguish what I tested from what is still pending.”

## Demo notes that prevent accidental misrepresentation

Use a fresh synthetic portfolio for the numerical sequence so existing edited seed totals do not confuse the demonstration. New portfolio ownership does not automatically add Editor/Viewer memberships; full membership management is deferred. Use seeded A/B for existing role combinations.

A fresh seed A starts at 600, but current database values may have changed. Never promise that screen before rehearsal. A price update after the +2 movement yields 820 at $60, not 700. Recording time does not prove quote freshness.

The only AI tools are getPortfolioSummary and listPositions. Do not promise AI movement history, purchases, recommendations, live quotes, writes or persistent chat. The model's prose can be wrong even if source cards are correct.

Tests with doubles are useful evidence of boundaries and SDK behavior, not successful Supabase/Gemini integration. Earlier user-provided concurrency output is identifiable historical evidence. The phase 7 limiter fix was tested through both the actual library handler and production loopback HTTP, but counters remain process-local.

## Main files and lines to review

Line references are anchors checked against the phase 8 source snapshot; later edits may shift them. Review the surrounding function, not only the cited line.

| File and starting line                                                                                                                                                                              | Be able to explain                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [schema.prisma](../prisma/schema.prisma#L23), lines 83/92/105/124                                                                                                                                   | Auth identity tables; Portfolio, scoped Membership, price-bearing Position, append-only Movement and unique/composite constraints |
| [invariants migration](../prisma/migrations/202610240002_invariants/migration.sql#L1), line 27                                                                                                      | USD/cash/nonzero SQL checks and append-only triggers; database owner can bypass them                                              |
| [auth.ts](../lib/server/auth.ts#L8), lines 17/24/26                                                                                                                                                 | Better Auth adapter, cookies, address-stripping hook, trusted header policy and process-local rate limit                          |
| [session.ts](../lib/server/session.ts#L7); [portfolios.ts](../lib/server/portfolios.ts#L7)                                                                                                          | Verified session identity and the only production service composition                                                             |
| [portfolio-service.ts](../lib/server/portfolio-service.ts#L17), lines 24/40/46/67                                                                                                                   | Deny-by-default membership/resource checks, trusted actor, serializable write helper and position lock                            |
| [portfolio-service.ts](../lib/server/portfolio-service.ts#L91), lines 103/151/163/189                                                                                                               | Atomic portfolio creation, filtered lists, position creation, replay/balance/insertion and price changes                          |
| [valuation.ts](../lib/server/valuation.ts#L27), lines 6/17                                                                                                                                          | Isolated Decimal precision, summing movements, cash invariants, exact value and zero allocation                                   |
| [contracts.ts](../lib/server/contracts.ts#L6); [http.ts](../lib/server/http.ts#L9), line 19                                                                                                         | Strict inputs, safe errors, same-origin JSON and actual body-size bound                                                           |
| [detail page](../app/portfolios/[portfolioId]/page.tsx#L8); [list page](../app/portfolios/page.tsx#L6)                                                                                              | Server initial reads, error/redirect boundary, portfolio-keyed assistant                                                          |
| [portfolio-actions.tsx](../app/portfolios/[portfolioId]/portfolio-actions.tsx#L192), lines 32/118                                                                                                   | Client form state, duplicate guard/request key, error preservation, server refresh; no financial totals state                     |
| [assistant.ts](../lib/server/assistant.ts#L33), lines 14/64/79/106                                                                                                                                  | Pre-provider validation, instructional versus enforced boundaries, step/token/time limits, sanitized errors and cancellation      |
| [assistant-tools.ts](../lib/server/assistant-tools.ts#L44), lines 51/82/106                                                                                                                         | Frozen context, fresh authorization on every execution and small source DTOs                                                      |
| [chat contracts](../lib/chat-contracts.ts#L3), lines 5/10/13/19; [assistant settings](../lib/server/assistant-settings.ts#L3)                                                                       | Limits, strict empty tool inputs, outputs and missing-key/model behavior                                                          |
| [portfolio-assistant.tsx](../app/portfolios/[portfolioId]/portfolio-assistant.tsx#L16)                                                                                                              | Actual useChat state, latest-question transport, pending/error/Stop, close/unmount and portfolio reset                            |
| [seed.ts](../prisma/seed.ts#L7); [seed-auth.ts](../prisma/seed-auth.ts#L12)                                                                                                                         | Insert missing fixtures, conflict checking, salted hashes and no silent password resets                                           |
| [access tests](../tests/access.test.ts#L1), [assistant tests](../tests/assistant.test.ts#L1), [auth security tests](../tests/auth-security.test.ts#L8), [API verifier](../scripts/verify-api.ts#L1) | Which checks use doubles; actual SDK/HTTP limiter behavior; real SQL preflight and overlapping-decrease test                      |

Use editor Go to Line for the numbers. Markdown line fragments are hints; some repository renderers do not jump to local source line fragments.

## Likely questions and code-grounded answers

| Question                                                  | Answer you can substantiate                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why one Next.js application?                              | Server Components and Route Handlers share the same server-only services; a separate Express service would duplicate deployment/contracts without a present need.                                                                                                                                                    |
| Why Better Auth rather than a homemade session?           | It supplies library password hashing, session persistence/cookies and auth endpoints. Our code adds portfolio membership authorization; the auth library does not decide portfolio roles.                                                                                                                            |
| Can a Viewer create a portfolio?                          | Yes. createPortfolio derives the authenticated actor and creates a new Owner membership in its transaction; Viewer is scoped to another portfolio.                                                                                                                                                                   |
| Can I bypass disabled buttons with curl?                  | Requests still reach services that check the session, membership, role and portfolio/position relation. Role/userId fields cannot authorize anything.                                                                                                                                                                |
| Is portfolioId trusted because it came from the UI?       | No. It is validated input; the session user's membership must authorize it before reads or provider use. Tool context is bound after that check.                                                                                                                                                                     |
| Why are quantities not columns edited by the browser?     | They are the sum of append-only movement deltas. Corrections append movements; prices update current valuation without editing quantity/history.                                                                                                                                                                     |
| What stops two simultaneous -8 movements from balance 10? | Position lock plus serializable aggregate/check/insert and fresh whole-transaction retries. Predicate/conflict detection matters because a lock alone does not refresh a snapshot. Current SQL rerun is blocked; earlier user output observed one success/final 2.                                                   |
| What if a movement request is sent twice?                 | Globally unique requestKey, content/actor/scope comparison and unique-race retry return the original DTO/time or conflict. Creating a portfolio does not have this idempotency guarantee.                                                                                                                            |
| Why Decimal and strings?                                  | Binary floating point loses financial precision. Decimal performs server arithmetic; strings preserve values across JSON. Tests include 0.1 + 0.2 and large products.                                                                                                                                                |
| What does the timestamp mean?                             | For new records, server UTC recording time. It cannot be backdated by the client and does not establish a fresh market quote. Existing historical timestamps are preserved.                                                                                                                                          |
| Can an injected position label access B?                  | Labels are data. Tools have empty input schemas, server-bound scope and fresh secured-service checks; there is no SQL/write/scope-selection capability. Tests exercise attempted overrides.                                                                                                                          |
| How do we trust AI numbers?                               | Tool source cards contain server-calculated strings/timestamps. Prompt instructions ask for exact quotes, but prose remains fallible; model arithmetic/security is not trusted.                                                                                                                                      |
| Which provider was used?                                  | Current code uses direct Google Gemini through @ai-sdk/google. Earlier OpenAI integration was replaced. The user confirms live Gemini works. The agent’s SDK tests used explicit mocks/stubbed fetch and controlled browser SSE; they are separate evidence, not its own live-provider success.                      |
| What happens without the key or on Stop?                  | Missing key/model disables sending; authorized API returns 503. Stop/close/unmount abort streaming; a DB read may finish internally but later data cannot reach the provider.                                                                                                                                        |
| Is the system production hardened?                        | No such claim: runtime DB/RLS/Data API and deployed origin checks are pending, limiter memory is per process, rememberMe expiry differs, and detailed clean-SQL/provider edge-case verification is incomplete. User-confirmed working database/Gemini and completed deployment do not by themselves prove hardening. |
| What did the coding agent do, and what did you do?        | AI_USAGE records agent code/docs/tests/research/debugging. User supplied phase decisions, Supabase setup, logs and API run output. Do not invent human code-review/ownership claims; explain your own understanding and remaining gaps.                                                                              |

## Recording and submission checklist

Preparation and recording:

- [ ] Confirm current deadline: end of October 25, 2026, Damascus time.
- [ ] Rehearse only the paths that work now; check audio/screen resolution and finish within 12–14 minutes.
- [ ] Confirm synthetic-only data; close secrets, cookies, personal tabs and notifications.
- [ ] Review the main functions above and explain them without reading generated code.
- [ ] Check 600 -> 700 -> 820 arithmetic on a fresh synthetic portfolio if the DB works.
- [ ] Show current test evidence and say which integrations failed or were not run.
- [ ] Record; review the resulting video for audio, readable code, truthful claims and accidental secret exposure. This review has not happened yet.

Repository access, performed by the user:

- [ ] Inspect Git diff/status and excluded files before choosing what to commit. Include the handoff docs and intended app changes; exclude local env/logs/fixtures.
- [ ] Verify the configured origin below exists and contains the intended revision; a local remote string does not prove a published commit.
- [ ] Make the repository public or grant the assessment reviewers appropriate access, according to the original instructions.
- [ ] Test the exact repository URL using the intended reviewer access context. Do not assume your signed-in owner session proves their access.
- [ ] Check README setup instructions and keep failed/not-run results visible; do not publish credentials or synthetic demo passwords.

Video upload, performed by the user:

- [ ] Upload the reviewed recording to your chosen host; ensure playback permission and audio work for reviewers.
- [ ] Copy the actual share link and test it in the appropriate signed-out/reviewer context.
- [ ] Replace “Not created yet” only after the link exists. Upload/review/access testing are not recorded as completed.

Reply to the original email thread, performed by the user:

- [ ] Reply in the existing assessment thread; use its actual recipient/subject and any requested delivery format.
- [ ] Include verified repository and video links; optional deployment only after checking it.
- [ ] Briefly state chosen scope and material verification limitations without claiming a live provider or human review that did not occur.
- [ ] Verify links and attachments, then send before the stated deadline. No email has been drafted in an external app or sent by this agent.

## Link register and optional reply text

| Item                               | Link / current evidence                                                                                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository origin                  | https://github.com/khaledhajij/wealth-portfolio-tracker.git — configured locally; remote visibility/revision/reviewer access not verified                                        |
| Recorded video                     | **Not created yet**                                                                                                                                                              |
| Uploaded video share link          | **Not created yet**                                                                                                                                                              |
| User-reported deployment, optional | https://wealth-portfolio-tracker-nine.vercel.app — existing reported URL; user confirms Vercel deployment is complete. No new agent live check or separate login acceptance run. |
| Submission email                   | Not sent by the agent; use the original thread                                                                                                                                   |

Text to adapt only after completing the checks:

> Hello,
>
> Here is my Wealth Portfolio Tracker assessment submission.
>
> Repository: [insert the verified repository link]
>
> Video: Not created yet
>
> I selected manual USD holdings, portfolio-scoped permissions and a read-only assistant. The repository documents implementation status, test evidence and remaining integration limitations.
>
> Thank you,
>
> [Your name]

Do not send this template with a missing video link or implied completed checks. No recording, upload, publication, access change or email is authorized for the agent in this phase.
