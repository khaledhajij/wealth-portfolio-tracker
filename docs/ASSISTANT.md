# Phase 6 read-only assistant

The user explicitly selected read-only streaming AI for phase 6, superseding the earlier delivery-readiness proposal. Implementation is local; successful live-provider/database acceptance is **not** claimed.

## Versions and setup

Installed versions: `ai` **7.0.153**, `@ai-sdk/react` **4.0.157**, `@ai-sdk/google` **4.0.105**, exact-pinned in the existing npm lockfile. They accept the installed Node 24, React 19.3 and Zod 4.6 versions. No AI SDK was installed at phase start; the initially selected OpenAI adapter was replaced and removed at the user's explicit request on 2026-10-25. No new application, database migration, authentication library or direct state-management dependency.

The provider is the direct Google Gemini Developer API through `createGoogle(...).languageModel(...)`. Create a key in [Google AI Studio](https://aistudio.google.com/apikey), then set `GOOGLE_GENERATIVE_AI_API_KEY` and `AI_MODEL` privately in `.env.local` and restart. The key name matches the Vercel adapter convention; no second native Google SDK is needed. OPENAI_API_KEY is no longer read. There is no implicit model, Gateway, Vertex AI, alternative-provider or canned-response fallback. Configuration presence does not prove provider availability. Missing either variable disables the UI and produces a safe 503 **after** session/membership validation. Never send private keys in chat or use `NEXT_PUBLIC_` names. Use synthetic demo questions and holdings only.

Example local entries (replace the key placeholder privately):

```dotenv
GOOGLE_GENERATIVE_AI_API_KEY=YOUR_PRIVATE_GEMINI_KEY
AI_MODEL=gemini-3.5-flash-lite
```

The example model is listed as stable with function calling in the official Google model documentation checked in this session; availability and quota depend on the API project. No free-usage or account-access guarantee is made. You may choose another available Gemini text model supporting streaming and function tools.

```powershell
npm ci
npm run build
npm start
```

Open an authorized portfolio and use the bottom-right **Ask AI** button. Provider/model access, cost, data-use terms and limits depend on the Google API project. The former OpenAI-specific store=false option was removed; no equivalent retention guarantee is inferred for Google. The application does not persist chat or enable SDK telemetry. Google-hosted search/code-execution capabilities are not enabled; only the two application read tools are supplied.

## Popup presentation

The user supplied a chat component reference and requested a popup. Its message bubbles, icons, entrance and real-pending dots are adapted into `components/ui/chat-messages.tsx`; the subsequent user theme request aligns its warm paper/sage surfaces, green accents, borders, serif heading, forms and focus/error treatment with the dashboard. Its sample Nexus conversation, timers, autoplay/replay and canned responses are omitted. The component is controlled by actual SDK messages and accepts rendered parts so server source cards/timestamps are preserved. It owns only scroll-follow behavior, not a second conversation or financial state. Users who scroll upward are not forced to the bottom by new chunks.

The app already has TypeScript/Tailwind. Shared presentation now follows the requested `components/ui` convention, and styles remain in `app/globals.css`. That folder separates reusable visuals from the portfolio-specific SDK controller; it is not a Next.js requirement. No Shadcn primitive is required by this custom component, so no CLI initialization/replacement, extra state library, cn utility or unrelated stock imagery was added. Exact runtime pins: `framer-motion` 14.6.0 and `lucide-react` 1.61.0. Named icons and LazyMotion/domAnimation are used; reduced-motion preference disables message movement and repeating dots.

Native modal dialog opens from a floating launcher only on authorized portfolio detail, shows the actual portfolio name/read-only status, and bounds itself to desktop/mobile dynamic viewport sizes. Initial focus goes to the question or Close when disabled. Context/log regions support keyboard scrolling; Tab/Shift+Tab wrap within visible controls, Escape/Close return focus to the launcher. Close stops a pending response and restores the draft; reopening retains this portfolio's local conversation. A portfolio-key change unmounts/stops the old instance and starts closed/empty. Opening alone makes no provider request.

Enter submits, Shift+Enter adds a line, and IME composition is respected. Clear conversation remains a real local reset, not replay. Pending/stream/tool/error/stopped/disabled states and safe plain-text output remain, including the original single-submit guard and distinct Stop/submit buttons. Desktop/mobile component checks use an explicitly labeled synthetic SSE harness; they are not a live provider or authenticated database result. See STATUS for the actual outcomes.

## Code flow and authorization

1. Dynamic detail page performs the existing secured reads. Only an availability boolean/message and selected portfolio ID go to the Client Component; keys stay in server-only settings/provider modules.
2. `useChat` renders the UI message stream. `DefaultChatTransport` submits only `{ portfolioId, message }` to POST `/api/chat`. Each question is independent: browser-provided history, assistant text, tool results, roles, user IDs and arbitrary instructions are not accepted as protocol fields. Text is rendered as escaped plain text.
3. The route reuses same-origin JSON/body/error protections. Its strict Zod contract validates the selected ID and question. `authorizePortfolioRead` derives the actor from the trusted session and verifies that portfolio's membership before provider construction/use. All three roles may read. The server freezes that validated user/portfolio context in a request-local tool closure; no private-data cache or context in provider metadata.
4. Each valid tool execution checks the current session/membership and matching bound identity, then calls the existing secured `getSummary` or `listPositions` service, which independently checks access and computes Decimal values. The model cannot choose another user, role, portfolio, SQL query or endpoint. Invalid/extra tool arguments are rejected. Labels/symbols are untrusted result data; they cannot change the closure or service authorization.
5. The provider streams tool states and explanatory text. New manual-price timestamps are server recording times; historical timestamps are retained. The prompt and tool description distinguish recording time from market quote freshness. UI source cards render exact server output and UTC manual-price timestamps. The prompt requires quoting source numbers without arithmetic and refuses writes/trades/recommendations. These prompt rules guide model prose; the hard security boundary is the two read-only capabilities plus service authorization, not prompt compliance. Model prose can still be wrong; source cards remain authoritative.

## Explicit contracts and limits

POST input is a strict name set: `portfolioId` (1-128 non-whitespace characters), `message` (trimmed, 1-2,000 UTF-16 characters). The actual streamed JSON body is capped at 8 KiB using the existing helper; chat also cancels a stalled body on its deadline. No files, attachments, system messages, client tool outputs or previous conversation are accepted.

Both tools accept a **strict empty object**:

| Tool                  | Small, validated output                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getPortfolioSummary` | USD, exact total/display total, position count, three asset-allocation groups, oldest/newest manual-price timestamps (null for empty). Uses all portfolio positions for the total; no labels or full holdings list. |
| `listPositions`       | Up to 10 ID-ordered rows with asset type, label/symbol, quantity, unit price, value and priceAsOf; USD and hasMore. No member details, actor IDs or portfolio/user IDs. Omitted rows are explicitly disclosed.      |

All monetary/quantity/percentage values come from existing server Decimal calculations as decimal strings. Cash remains fixed at USD 1. Tool output schemas enforce decimal/timestamp/string/list bounds before disclosure. Tools may read at different moments if manual holdings/prices change concurrently; this is not a shared historical snapshot or live market view. Result size is bounded, but the existing service still reads a portfolio's underlying movement-derived data; database aggregation optimization is outside this phase.

- At most **3 model steps**, **600 output tokens per step** (at most 1,800 across three steps), **4 tool executions**, one tool execution concurrently; **0 automatic provider retries**.
- Overall request deadline **30 seconds**, including preflight; SDK per-step **15 seconds** and inter-chunk **10 seconds**. Next route duration allowance is 40 seconds; the application deadline remains 30.
- Client disconnect/Stop or portfolio unmount aborts the upstream model. Cancelling the response stream explicitly aborts the controller. Pending Prisma reads without native cancellation may finish internally, but their aborted wait cannot return data to the provider. Raw provider/database errors are replaced with safe messages, including stream/tool errors.
- UI shows waiting/streaming/tool-pending/source-result/error/stopped states; input is retained/restored on failures and error focus is explicit. Six questions per local conversation, then Clear; no automatic resubmission/reconnect. New portfolio key unmounts/stops the prior instance and clears its messages. The six-question bound is a UI/session-memory limit, not a durable per-user request quota.

No SQL/shell/network browsing/write/trading tool exists. No AI history tool, invitations, membership editing, deletion, market prices or investment recommendations were added. Earlier authentication/runtime-privilege limitations in AUTH/STATUS remain unchanged.

## Verification and remaining gates

Current unit/component/production negative-path evidence is in [STATUS](STATUS.md). SDK mock models and controlled SSE component fixtures are explicitly tests; they do not prove live model behavior, billing/access, or real authenticated PostgreSQL execution. Tests force an adversarial model call after reading an instruction-like label and verify it cannot reach foreign scope; they do not claim all prompt injection can be detected or all model prose is reliable.

From a database-connected terminal:

```powershell
npm run build
npm run test:api
npm run test:ui
```

The expanded `test:api` reuses real Better Auth sessions and synthetic PostgreSQL fixtures, validates chat denial/disabled configuration and executes secured read tools through a real-session reader. Its child server explicitly clears AI configuration, so the regression suite never contacts a provider. No reset, schema edits or deletion of existing holdings. Its new SQL/chat stages remain unverified here because migration preflight failed.

For a live check after configuration, sign in to a synthetic demo portfolio and ask for its total/allocation and positions. Compare the source cards/manual times with the dashboard, test Stop and portfolio switching, and try a write request (it should be refused without a write tool). Verify a nonmember portfolio request is denied before any provider request. Record actual results before declaring live integration complete. No live test was performed by the agent in this phase.

## Official references checked

- [AI SDK v7 streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text), [tools](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool), [tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling).
- [useChat](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat), [chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot), [tool states](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage), [SDK mock testing](https://ai-sdk.dev/docs/ai-sdk-core/testing).
- [AI SDK v7 Google adapter](https://ai-sdk.dev/providers/ai-sdk-providers/google), including createGoogle, private key header and language-model API; installed 4.0.105 types/source checked.
- [Motion bundle guidance](https://motion.dev/docs/react-reduce-bundle-size), [reduced motion](https://motion.dev/docs/react-use-reduced-motion), [Lucide React](https://lucide.dev/guide/react), [native dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) for the supplied popup reference adaptation.
- [Google API key setup](https://ai.google.dev/gemini-api/docs/api-key), [Google model catalog](https://ai.google.dev/gemini-api/docs/models), [Gemini 3.5 Flash-Lite model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite). No live model access or quota inferred from documentation.
