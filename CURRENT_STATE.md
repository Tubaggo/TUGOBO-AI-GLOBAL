# TUGOBO AI — CURRENT STATE

> Context-stabilization document. This file describes the **real, observed state** of the
> repository so any future Claude/agent session can continue without re-deriving context.
> It is documentation only — no runtime behavior, schema, or product code is changed by this file.
>
> Last reviewed: 2026-06-02 · Branch: `main`

---

## 1. Product Identity

**TUGOBO AI is an AI-native hotel operational intelligence system.**

- It is **NOT** a chatbot, a generic dashboard, or a CRM.
- Core philosophy: **AI works, humans supervise.** The AI runs reservation/payment/recovery
  operations autonomously; human operators watch, take over selectively, and hand back.
- The product surface is a **dark, premium operational runtime** ("digital hotel operations
  center") — guest conversations, reservation lifecycle, payment lifecycle, recovery flows,
  revenue attribution, and an operational event feed — not a CRUD admin panel.
- Primary language of the operator-facing UI is **Turkish** (with multilingual guest
  conversations: TR/DE/RU/EN/IT, etc.).

Domains (per `DEPLOYMENT.md`):
- `tugobo.com` — marketing/landing
- `app.tugobo.com` — operator panel + app APIs
- `lead.tugobo.com` — reserved for a future lead engine (not deployed)

---

## 2. Current Stack (confirmed from `package.json` files)

**Monorepo:** pnpm workspaces (`pnpm >= 9`, Node `>= 20`). Root is `tugobo-ai`.

`apps/web` (the Next.js app — primary surface):
- **Next.js 15.3.1** (App Router, `next dev --turbo`)
- **React 19**
- **TypeScript 5.4** (`strict: true`; typecheck via `tsconfig.typecheck.json`)
- **Tailwind CSS 3.4** (+ autoprefixer, postcss)
- **Zustand 5** — client-side operational store (`useOperationalStore`)
- **next-intl 4** — i18n / localization
- **Vercel AI SDK (`ai` 4.3)** + **`openai` 4.1** — server-side AI routes
- **Drizzle ORM** via `@tugobo/db` (Postgres / Supabase)
- **@supabase/ssr** + **@supabase/supabase-js** — auth, realtime, DB
- **Inngest 3** — durable workflows (scaffolded)
- **Twilio 5** — WhatsApp channel
- **Radix UI** primitives + **lucide-react** icons + `clsx` / `tailwind-merge` / `cva`

Workspace packages (`packages/*`):
- `@tugobo/shared` — types, logger, env (Zod). Source of lifecycle/payment/channel enums.
- `@tugobo/db` — Drizzle schema + client (every business table carries `hotel_id`).
- `@tugobo/channels` — channel adapters (Twilio/Meta) behind a `ChannelAdapter` interface.
- `@tugobo/core` — agents, tools, Inngest workflows, prompts (roadmap-stage).

Also present: `supabase/` (migrations), `.cursor/docs` + `.cursor/rules` (internal docs/rules),
DeepSeek/Gemini/Claude provider stubs under `apps/web/lib/ai/providers/`.

---

## 3. Current Architecture Summary

### App routing (`apps/web/app/`)
Multiple panel route groups exist; **`app/dashboard/` is the canonical implementation** and
the others largely re-export it:
- `app/dashboard/` — the real operator panel (conversations, operations, payments, reports,
  reservations, guests, settings). `app/dashboard/conversations/page.tsx` is the **central hub
  (~4,350 lines)** that wires conversations → reservation/payment/lifecycle UI.
- `app/app/` — alternate route surface; pages re-export dashboard (e.g.
  `app/app/conversations/page.tsx` → `@/app/dashboard/conversations/page`). Has its own rich
  `_components/` (intelligence panels, timelines, reasoning blocks).
- `app/demo/otel-paneli/` — sales/demo panel; pages also re-export dashboard pages, wrapped in a
  demo layout/banner.
- `app/(dashboard)/` — older route group (analytics, inbox, knowledge, reservations, settings).
- `app/(marketing)/` — landing site + `sales-demo-scenario-engine.ts`.
- `app/api/` — route handlers: `conversations/*` (messages, payment, reservation,
  reservation-lifecycle, takeover, ingest), `operations/feed`, `ai/respond`,
  `intelligence/chat`, `settings/channels/*`, `integrations/manychat/*`, `webhooks/twilio`,
  `inngest`, `demo`.

### Main runtime areas (`apps/web/lib/`)
- **`lib/runtime/`** — the operational runtime "brain":
  - `store/useOperationalStore.ts` — Zustand store; event dispatch
    (`PAYMENT_FAILED`, `RECOVERY_STARTED`, `BOOKING_CONFIRMED`, `HUMAN_TAKEOVER`,
    `OTA_CONVERSION`, `VIP_ESCALATION`, `UPSELL_ACCEPTED`, …) plus deprecated legacy `applyMutation`.
  - `store/initial-state.ts`, `store/graph-seed.ts`, `store/selectors.ts` — seed/demo state.
  - `entities/index.ts` — **single source of truth** for runtime types: `Reservation`,
    `ConversationThread`, `Guest`, `RecoveryFlow`, `RevenueSnapshot`, `AiImpactSnapshot`,
    `OperationsFeedItem`, `ReservationPipelineStage`, etc.
  - `conversation-runtime.ts` — derives operational status labels, guest runtime signals,
    cognition snapshots, and the **operational timeline** (`THREAD_CHRONOLOGY` scripted beats
    per conversation `c1..c4`, with fallback chronology).
  - `events/`, `graph/` (reasoning, propagation, memory, enrich, stream), `live/`,
    `simulations/engine.ts`, `chat-bridge.ts`.
- **`lib/conversation/`** — `models.ts` (`LiveConversation`, `ReservationLifecycleEvent`,
  `ReservationPaymentEvent`, `LiveReservationSummary`, `ReservationAiSuggestion`), `live-sync.ts`.
- **`lib/server/`** — server-side runtime services (see lifecycle/payment below).
- **`lib/ai/`** — `aiClient.ts`, providers (openai/deepseek/gemini/claude), `confidence.ts`,
  `guards.ts`, `audit.ts`, prompts, `use-guest-ai-response.ts`.
- **`lib/i18n/`** — `operationalTexts.ts` (`op()` helper, Turkish operational copy),
  `runtime-copy.ts`, `operational-copy.ts`, `panel-locale.ts`, `config.ts`.
- **`lib/channels/`** — ingest, bridges, simulate-incoming/ai-response, unified-message.
- **`lib/stores/`** — `conversation-ai-store.ts`, `operation-conversation-store.ts`.
- **`lib/realtime/`** + **`lib/panel/`** — Supabase realtime subscriptions, live panel overlay,
  staged load orchestration.

### Conversation system
- Static demo threads: `app/dashboard/_components/chat-threads.ts` (`CHAT_THREADS` for
  `c1..c8`, each with messages + optional `ConvReservation`). `mock-data.ts` holds
  `Conversation`/`ConversationStatus` types.
- Live conversations flow through `lib/conversation/models.ts` + `lib/server/conversations/service.ts`
  + the `app/api/conversations/*` routes, with realtime sync hooks.
- Conversation UI: `app/app/conversations/_components/` — `live-guest-chat.tsx` (chat thread +
  reservation card + AI moments), `operation-intelligence-panel.tsx` (the **right sidebar**:
  284px aside with stage/confidence/escalation/supervision), `operational-timeline.tsx`,
  `ai-cognition-layer.tsx`, `reservation-operation-card.tsx`, `guest-runtime-queue.tsx`,
  `propagation-causality-strip.tsx`.
- Status model: `ConversationThread.status` is `ai_active | human_takeover | resolved`.

### Operational feed
- `lib/server/operations/operation-feed.ts` — append-only feed of `SafeOperationFeedEvent`
  (`guest_request_received`, `operator_replied`, `ai_support_prepared`, `reservation_lifecycle`,
  `message_sent`, `delivery_failed`, `connection_test_success`, `channel_pending`,
  `unauthorized_channel_request`). PII-safe by design.
- Surfaced via `app/api/operations/feed` and the operations pages.

### Reservation lifecycle
- `lib/server/reservations/lifecycle.ts` is authoritative.
- States (`ReservationLifecycleState`): `inquiry_received`, `quote_prepared`, `quote_sent`,
  `payment_link_sent`, `payment_pending`, `confirmed`, `cancelled`, `expired`,
  `human_review_required`.
- `recordReservationLifecycleEvent()` is **idempotent on latest state** (skips duplicate
  consecutive states), writes an `operationalEvents` row (kind `reservation_lifecycle`), and
  **propagates** to: conversation columns (`reservationState`, `paymentState`, `escalationState`,
  `status`) via `stateToConversationState()`, the `reservations` row status + timeline via
  `stateToReservationStatus()`, and the operation feed.
- `aiSuggestionFor(state)` produces the AI next-action suggestion shown in the panel.

### Payment lifecycle
- `lib/server/payments/payment-runtime.ts` is authoritative.
- States (`ReservationPaymentState`): `not_started`, `payment_link_sent`, `payment_pending`,
  `paid`, `failed`, `expired`, `refunded`.
- `recordPaymentEvent()` is also idempotent on latest state, writes `operationalEvents` rows
  (kind `payment_lifecycle`), and emits a feed event when `paid`.
- Note: payment runtime and reservation lifecycle are **separate stores/event kinds** that both
  feed the conversation view — a key source of the consistency work in §6.

### Right sidebar logic
- `operation-intelligence-panel.tsx` renders supervision state, reservation stage label,
  AI confidence %, escalation risk, and recommended action, derived from a blend of
  `CognitionSnapshot` (runtime) and live `ConversationAiState` (`aiState` overrides when present).
- The in-thread **reservation card** (`reservation-operation-card.tsx`) shows status via a
  color-coded `statusMap` (`confirmed` / `pending_payment` / `quoted` / `cancelled` /
  `human_review`) and a "send payment link" affordance for `pending_payment`/`quoted`.

### Persistence approach
- **Production:** Supabase Postgres via Drizzle (`operationalEvents`, `conversations`,
  `reservations`, `contacts`, …). Multi-tenant by `hotel_id`; RLS enforced.
- **Local dev (no/synthetic DB):** file-backed JSON under `.tugobo-dev/`
  (`reservation-lifecycle.json`, `payment-events.json`, `operation-feed.json`, ManyChat events)
  plus `globalThis`-scoped in-memory stores, hydrated lazily. Activated by
  `shouldUseLocalStore()` when `NODE_ENV !== production` and the conversation is demo/synthetic,
  the hotel is the local test hotel, the conversation id is not a UUID, or `db` is absent.
- **Client demo state:** Zustand `useOperationalStore` is **in-memory only** (no `persist`
  middleware observed); seeded from `initial-state.ts` / `graph-seed.ts` and mutated by dispatch.

---

## 4. Completed Systems Found in Code

- **Live channel health / runtime** — `app/api/settings/channels/health`, `.../test`,
  `.../rotate-secret`; `lib/server/channels/service.ts`; channel feed + live operation feed
  (recent commit `4f443b0 feat: add channel health and live operation feed`).
- **Operational feed** — append-only, PII-safe, dev-persisted; wired into lifecycle + payment.
- **AI / human takeover** — `app/api/conversations/[id]/takeover`; conversation `status`
  transitions `ai_active ↔ human_takeover ↔ resolved`; UI buttons (Take over / Hand to AI);
  reply box disabled while AI-active.
- **Reservation lifecycle** — full state machine + DB/feed/conversation propagation (§3).
- **Payment lifecycle** — full state machine + feed emission on `paid` (§3); recent commits
  `9273460 stabilize payment lifecycle and reservation confirmation runtime`,
  `ae1bed5 persist reservation lifecycle state across refresh`.
- **Turkish localization** — `op()` helper + `operationalTexts.ts`; next-intl panel locale;
  operator-facing copy is Turkish, guest copy multilingual.
- **Local persistence** — `.tugobo-dev/*.json` dev stores (commit `cabb755 persist local dev
  manychat events`).
- **Demo / runtime behavior** — scripted conversation chronologies (`THREAD_CHRONOLOGY`),
  seed operational state, `lib/runtime/simulations/engine.ts`, `lib/panel/demo-orchestration.ts`,
  `(marketing)/sales-demo-scenario-engine.ts`, `app/demo/otel-paneli/` panel.
- **Operational outcome sidebar lifecycle** — recent commit `3e607d8 feat: normalize operational
  outcome sidebar lifecycle states` (the most recent work; §6/§8 continue it).

---

## 5. Current Priority Order

1. **Sales demo strength** — the demo panel must look and feel like a real, live operations center.
2. **Reservation lifecycle realism** — believable, internally consistent state progression.
3. **Operational runtime polish** — feed, sidebar, timeline, badges all coherent.
4. **Real AI integration** — later (provider stubs and `ai/respond` exist but are not the focus yet).
5. **Channel integrations** — later (Twilio/Meta/ManyChat adapters exist; full wiring deferred).

---

## 6. Known Current Focus

- **Conversation outcome sidebar normalization** — make the right-side intelligence panel and the
  in-thread outcome reflect one coherent lifecycle state.
- **Reservation/payment state consistency** — the reservation lifecycle store and the payment
  lifecycle store are separate; the UI must never show a contradictory blend of the two.
- **Mock vs runtime-generated reservation visual consistency** — static `CHAT_THREADS`
  reservations (`ConvReservation`) and runtime/DB-generated reservations must render identically
  and map to the same status vocabulary.
- **No contradictory states** — e.g. never show "Tutar bekleniyor" (payment pending) together
  with "Onaylandı" (confirmed). Confirmed must imply paid; pending must not co-exist with confirmed.

---

## 7. Important Product Rules

- **No "Test Guide" user-facing text.** Test/demo scaffolding must not leak into operator/guest UI.
- **No "ManyChat" / "Manychat" user-facing text** unless strictly technical/admin-only (env,
  internal integration routes). It must not appear in operator-facing or guest-facing surfaces.
- **Preserve the dark, premium operational runtime aesthetic** (zinc-950 surfaces, subtle
  borders/rings, status-colored accents, glow on live mutation).
- **Avoid a fake SaaS / CRM / card-dashboard feeling.** This is an operations center, not a CRUD app.
- **Preserve existing architecture** — `entities/index.ts` is the single source of truth for
  runtime types; `lib/server/*` are the authoritative lifecycle/payment/feed services.
- **No unnecessary refactors.**
- **No schema changes** unless explicitly requested. Respect `.cursor/rules`: Drizzle-only DB
  access, channel adapters only, agent side-effects via typed tools, never log phone numbers or
  message bodies, every business table has `hotel_id`, validate Twilio signatures.

---

## 8. Recommended Next Coding Task — Conversation Outcome Sidebar Normalization

**Goal:** guarantee that, for any conversation (mock `CHAT_THREADS` thread *or* runtime/DB-driven
live conversation), the in-thread reservation/outcome card and the right intelligence sidebar
display a **single, non-contradictory lifecycle state**.

**Where the work lives (do NOT implement yet — this is the plan for the next session):**
- `app/app/conversations/_components/operation-intelligence-panel.tsx` — right sidebar; currently
  blends `CognitionSnapshot` (runtime heuristics) with optional live `aiState`.
- `app/app/conversations/_components/reservation-operation-card.tsx` — in-thread status card
  (`statusMap`: confirmed / pending_payment / quoted / cancelled / human_review).
- `lib/server/reservations/lifecycle.ts` (`stateToConversationState`, `stateToReservationStatus`)
  and `lib/server/payments/payment-runtime.ts` — the two state machines that must be reconciled
  into one display state.
- `lib/runtime/conversation-runtime.ts` (`buildCognitionSnapshot`, status derivation) and
  `lib/i18n/operationalTexts.ts` (the `op(...)` labels such as `resPendingPayment`,
  `resConfirmed`, `resQuoted`).

**What "done" should mean:**
1. A single derivation maps `{reservationLifecycleState, paymentState, conversation.status}` →
   one canonical outcome label + severity, used by **both** the card and the sidebar.
2. `confirmed`/`paid` outcomes never co-render "Tutar bekleniyor"; payment-pending never
   co-renders "Onaylandı".
3. Mock reservations and runtime/DB reservations resolve through the same mapping (no divergent
   status vocabularies between `ConvReservation.status` and `ReservationLifecycleState`).
4. No schema change, no new store, no aesthetic regression; Turkish copy preserved; no
   "Test Guide"/"ManyChat" leakage.

**Suggested approach:** introduce a pure, well-tested derivation helper (e.g. in
`lib/runtime/conversation-runtime.ts` or a small new `lib/runtime/outcome.ts`) that both
components consume, rather than each component independently inferring state. Confirm the exact
contradiction cases first by exercising the demo threads + dev lifecycle JSON before coding.

---

### Quick orientation for the next session
- Central UI hub: `app/dashboard/conversations/page.tsx` (~4,350 lines; re-exported by
  `app/app/...` and `app/demo/otel-paneli/...`).
- Runtime types: `apps/web/lib/runtime/entities/index.ts`.
- Lifecycle/payment authorities: `apps/web/lib/server/reservations/lifecycle.ts`,
  `apps/web/lib/server/payments/payment-runtime.ts`.
- Turkish copy: `apps/web/lib/i18n/operationalTexts.ts` via `op()`.
- Verify with: `pnpm --filter web type-check` and `pnpm --filter web build`.
