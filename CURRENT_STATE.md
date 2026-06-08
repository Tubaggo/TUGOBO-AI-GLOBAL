# TUGOBO AI — CURRENT STATE

> Authoritative project snapshot. This file describes the **real, observed state** of the
> repository so any future Claude/agent session can continue without re-deriving context.
> It is documentation only — no runtime behavior, schema, or product code is changed by this file.
>
> Last reviewed: 2026-06-08 · Branch: `main`

---

## 1. Product Identity

**TUGOBO AI is an AI-native hotel operational intelligence runtime.**

- It is **NOT** a chatbot, **NOT** a CRM, and **NOT** a traditional SaaS dashboard.
- Core philosophy: **"AI works, humans supervise."** The AI runs reservation, payment, and
  recovery operations; human operators watch, take over selectively, and hand back.
- The product surface is a **dark, premium operational runtime** ("digital hotel operations
  center") — guest conversations, reservation lifecycle, payment lifecycle, recovery flows,
  revenue attribution, and an operational event feed — not a CRUD admin panel.
- Operator-facing UI is **Turkish**; guest conversations are multilingual (TR/DE/RU/EN/IT, …).

Domains:
- `tugobo.com` — marketing/landing
- `app.tugobo.com` — operator panel + app APIs
- `lead.tugobo.com` — reserved for a future lead engine (not deployed)

---

## 2. Current Priorities

1. **VPS deployment preparation**
2. **Pilot hotel readiness**
3. **Real channel integrations** (Instagram/WhatsApp via ManyChat/Meta/Twilio)
4. **Sales rollout**
5. **Architecture cleanup** — later

---

## 3. Current Stack

**Monorepo:** pnpm workspaces (`pnpm >= 9`, Node `>= 20`). Root is `tugobo-ai`.

`apps/web` (Next.js app — primary surface):
- **Next.js 15.3.1** (App Router, `next dev --turbo`), **React 19**, **TypeScript 5.4** (strict)
- **Tailwind CSS 3.4**, **Zustand 5** (operational store), **next-intl 4**
- **Vercel AI SDK (`ai` 4.3)** + **`openai` 4.1** — server-side AI routes
- **Drizzle ORM** via `@tugobo/db` (Postgres / Supabase), **@supabase/ssr** + **supabase-js**
- **Inngest 3** (durable workflows, scaffolded), **Twilio 5** (WhatsApp channel)
- **Radix UI** + **lucide-react** + `clsx`/`tailwind-merge`/`cva`

Workspace packages (`packages/*`): `@tugobo/shared` (types, logger, env/Zod),
`@tugobo/db` (Drizzle schema + client; every business table carries `hotel_id`),
`@tugobo/channels` (channel adapters behind `ChannelAdapter`), `@tugobo/core` (agents, tools,
Inngest workflows, prompts — roadmap-stage).

AI providers live under `apps/web/lib/ai/providers/`: `openai`, `deepseek`, `claude`, `gemini`,
and `mock-provider`, behind a registry (`index.ts`).

---

## 4. Architecture Summary

### App routing (`apps/web/app/`)
- `app/dashboard/` — **canonical** operator panel. `app/dashboard/conversations/page.tsx` is the
  central hub (~4,350 lines) wiring conversations → reservation/payment/lifecycle UI.
- `app/app/` — alternate route surface; re-exports dashboard pages, has its own rich
  `_components/` (intelligence panels, timelines, reasoning blocks).
- `app/demo/otel-paneli/` — sales/demo panel; re-exports dashboard pages in a demo layout.
- `app/(dashboard)/` — older route group. `app/(marketing)/` — landing + demo scenario engine.
- `app/api/` — route handlers: `conversations/*`, `operations/feed`, `ai/respond`,
  `intelligence/chat`, `settings/channels/*` (health/test/configure/rotate-secret),
  `integrations/manychat/*` (inbound, **simulate-inbound**), `webhooks/twilio`, `inngest`, `demo`.

### Runtime areas (`apps/web/lib/`)
- **`lib/runtime/`** — operational "brain": `store/useOperationalStore.ts` (Zustand, event
  dispatch), `entities/index.ts` (**single source of truth** for runtime types),
  `conversation-runtime.ts` (status labels, cognition snapshots, scripted timelines),
  plus `events/`, `graph/`, `live/`, `simulations/engine.ts`.
- **`lib/ai/`** — `aiClient.ts`, `providers/*` (+ registry), `confidence.ts`, `guards.ts`,
  `audit.ts`, prompts (`hotelAssistantPrompt.ts`), `use-guest-ai-response.ts`.
- **`lib/i18n/`** — `operationalTexts.ts` (`op()` Turkish copy), `detect-language.ts`
  (dependency-free script/diacritic language detection: TR/DE/RU/EN), locale config.
- **`lib/channels/`** — `ingestMessage.ts`, bridges, `types.ts`, simulate flows.
- **`lib/server/`** — authoritative lifecycle/payment/feed/channel services (below).

### Reservation lifecycle
`lib/server/reservations/lifecycle.ts` is authoritative. States: `inquiry_received`,
`quote_prepared`, `quote_sent`, `payment_link_sent`, `payment_pending`, `confirmed`,
`cancelled`, `expired`, `human_review_required`. `recordReservationLifecycleEvent()` is
idempotent on latest state, writes an `operationalEvents` row, and propagates to conversation
columns, the `reservations` row, and the operation feed.

### Payment lifecycle
`lib/server/payments/payment-runtime.ts` is authoritative. States: `not_started`,
`payment_link_sent`, `payment_pending`, `paid`, `failed`, `expired`, `refunded`.
`recordPaymentEvent()` is idempotent and emits a feed event on `paid`.

### Channel readiness layer
`lib/server/channels/service.ts` backs channel health/test/configure and outbound config.
ManyChat inbound is the live ingestion path; `integrations/manychat/simulate-inbound` builds a
realistic Instagram-style DM payload and forwards it through the **real** inbound endpoint (no
parallel ingestion path). The simulator returns 404 in production.

### Persistence
- **Production:** Supabase Postgres via Drizzle. Multi-tenant by `hotel_id`; RLS enforced.
- **Local dev:** file-backed JSON under `.tugobo-dev/` + `globalThis` in-memory stores,
  activated by `shouldUseLocalStore()` for demo/synthetic conversations or when `db` is absent.
- **Client demo state:** Zustand `useOperationalStore` is in-memory only.

---

## 5. Completed

- **Reservation lifecycle runtime** — full state machine + DB/feed/conversation propagation.
- **Payment lifecycle runtime** — full state machine + feed emission on `paid`.
- **Operational feed runtime** — append-only, PII-safe (`SafeOperationFeedEvent`).
- **AI Runtime Transparency** — provider/model/timing/confidence metadata surfaced on AI bubbles.
- **DeepSeek provider integration** — added alongside OpenAI/Claude/Gemini/mock in the registry
  with config-driven model/base-url and fallback ordering (`resolveConfiguredProvider`).
- **AI Yanıt Öner (supervised AI reply)** — controlled, human-supervised AI reply action
  (renamed from the earlier test trigger).
- **AI message persistence** — static/test AI reply persistence isolated and stabilized.
- **Multi-language AI replies** — `detect-language.ts` + guest-language directive enforced in
  `hotelAssistantPrompt.ts`, so AI replies in the guest's language.
- **Channel readiness layer** — health/test/configure/rotate-secret + live operation feed.
- **Outbound channel configuration** — configure route + service-backed outbound config.
- **Instagram inbound simulator** — dev/demo-only, routes through the real ManyChat inbound
  pipeline; open-inquiry lifecycle stabilized.
- **Language normalization** — guest-language detection + reply-language directive.
- **Production environment hardening** — `instrumentation.ts` fail-fast guard
  (`assertProductionEnv()` runs only at Node server startup in production), expanded
  `packages/shared/src/env.ts` validation, and a documented `.env.example`.

---

## 6. Current State (realistic assessment)

- **Demo readiness: strong.** The demo/sales panel behaves like a live operations center —
  scripted conversation chronologies, seeded operational state, reservation/payment lifecycle,
  operation feed, AI transparency, and multilingual replies all render coherently.
- **Pilot readiness: near-ready, gated on real channels + VPS.** The runtime, lifecycle engines,
  persistence, and channel readiness layer are in place. A pilot still needs a real channel
  connection (Instagram/WhatsApp) and a deployed production environment.
- **Production readiness: not yet.** Code-level environment hardening is done, but no VPS
  infrastructure, web server, process manager, SSL, production Supabase, or DNS cutover exists yet.

---

## 7. Known Limitations

- Real **Instagram** is not yet connected (validated only via the ManyChat-style simulator).
- Real **WhatsApp** is not yet connected.
- The **Twilio webhook** is still a stub (signature validation pattern defined, not live).
- The **simulator** exists for channel/runtime validation only; it is disabled in production.
- **VPS deployment** has not been completed.

---

## 8. Deployment Status

**Completed:**
- Production environment hardening (startup fail-fast guard + env validation + `.env.example`).

**Pending:**
- VPS infrastructure
- Nginx (reverse proxy)
- PM2 / systemd (process management)
- SSL certificates
- Production Supabase
- DNS cutover

---

## 9. Product Rules (preserve)

- No user-facing "Test Guide" or "ManyChat"/"Manychat" text (technical/admin env/routes only).
- Preserve the dark, premium operational runtime aesthetic (zinc-950 surfaces, subtle borders,
  status-colored accents, glow on live mutation). Avoid a fake SaaS/CRM/card-dashboard feel.
- Preserve architecture: `entities/index.ts` is the single source of truth for runtime types;
  `lib/server/*` are the authoritative lifecycle/payment/feed/channel services.
- No schema changes unless explicitly requested. Respect `.cursor/rules`: Drizzle-only DB access,
  channel adapters only, agent side-effects via typed tools, never log phone numbers or message
  bodies, every business table has `hotel_id`, validate Twilio signatures.

---

## 10. Recommended Next Step

**DEPLOY-3 — VPS Infrastructure Readiness.**

Stand up the production environment: VPS provisioning, Nginx reverse proxy, PM2/systemd process
management, SSL, production Supabase, and DNS cutover — building on the completed environment
hardening to move from demo/pilot-ready code to a live, deployed runtime.

---

### Quick orientation for the next session
- Central UI hub: `apps/web/app/dashboard/conversations/page.tsx` (re-exported by `app/app/...`
  and `app/demo/otel-paneli/...`).
- Runtime types: `apps/web/lib/runtime/entities/index.ts`.
- Lifecycle/payment authorities: `apps/web/lib/server/reservations/lifecycle.ts`,
  `apps/web/lib/server/payments/payment-runtime.ts`.
- AI providers + registry: `apps/web/lib/ai/providers/` (`index.ts`).
- Language detection: `apps/web/lib/i18n/detect-language.ts`; Turkish copy: `operationalTexts.ts`.
- Production guard: `apps/web/instrumentation.ts` + `packages/shared/src/env.ts`.
- Verify with: `pnpm --filter web type-check` and `pnpm --filter web build`.
