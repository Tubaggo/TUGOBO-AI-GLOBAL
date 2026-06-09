# TUGOBO AI — VPS Deployment Runbook

> Practical, follow-along runbook for deploying TUGOBO AI to a **Hostinger VPS** and serving
> the operator panel at **`app.tugobo.com`**.
>
> Status of prior stages: DEPLOY-1 (audit) ✅ · DEPLOY-2 (env hardening) ✅ ·
> DEPLOY-3 (VPS readiness plan) ✅ · DEPLOY-3B (migration path fix) ✅ ·
> DEPLOY-5 (migration strategy clarified) ✅.
>
> This document is operational documentation only. It changes no runtime behavior.
> Run every command as the **`tugobo`** deploy user unless a step says `sudo`/`root`.

---

## 1. Target Architecture

| Layer | Choice |
|---|---|
| Host | Hostinger VPS (KVM) |
| OS | Ubuntu 24.04 LTS |
| Runtime | Node.js 20 LTS |
| Package manager | pnpm 9 (via Corepack) |
| App | Next.js 15 (`apps/web`), React 19, App Router |
| Process manager | PM2 |
| Reverse proxy | Nginx |
| TLS | Let's Encrypt (certbot) |
| Domain | `app.tugobo.com` → `127.0.0.1:3000` (Next.js) |
| Database / Auth | Supabase (Postgres + Auth), multi-tenant by `hotel_id` (RLS) |
| AI provider | DeepSeek (`TUGOBO_AI_PROVIDER=deepseek`) |

**Recommended sizing:** 8 GB RAM / 2–4 vCPU / 80 GB NVMe. The production build forces a 4 GB
Node heap (`--max-old-space-size=4096`); on a 4 GB VPS add swap (§2) or build in CI.

Request flow:

```
Browser ──HTTPS──▶ Nginx (443, app.tugobo.com) ──proxy──▶ Next.js (127.0.0.1:3000, PM2)
                                                              │
                                                              ├─▶ Supabase Postgres (DATABASE_URL)
                                                              ├─▶ Supabase Auth (magic link)
                                                              └─▶ DeepSeek API
```

---

## 2. Server Preparation

### 2.1 Create the deploy user
```bash
ssh root@<VPS_IP>
adduser tugobo
usermod -aG sudo tugobo
# (recommended) copy your SSH key to the tugobo user, then in /etc/ssh/sshd_config:
#   PermitRootLogin no
#   PasswordAuthentication no
systemctl restart ssh
```

### 2.2 Firewall
```bash
sudo apt update && sudo apt -y install ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

### 2.3 System packages
```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install git curl ca-certificates build-essential nginx
```

### 2.4 Optional swap (do this if RAM < 8 GB)
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### 2.5 Node 20 + pnpm 9
```bash
# Node 20 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs
node -v          # expect v20.x

# pnpm 9 via Corepack
sudo corepack enable
corepack prepare pnpm@9 --activate
pnpm -v          # expect 9.x
```

---

## 3. Repository Setup

```bash
sudo mkdir -p /var/www && sudo chown tugobo:tugobo /var/www
cd /var/www
git clone <YOUR_REPO_URL> tugobo-ai
cd tugobo-ai
```

### Environment file location
The app is started from the repo root, so the runtime env file lives at the **repo root**:

```
/var/www/tugobo-ai/.env.production
```

Create it from the template and lock down permissions:
```bash
cp .env.example .env.production
nano .env.production         # fill in real values (see §4)
chmod 600 .env.production    # secrets on disk — owner read/write only
```

### `.env.production` guidance
- Only `NEXT_PUBLIC_*` variables reach the browser. **Never** prefix a secret with `NEXT_PUBLIC_`.
- `NODE_ENV=production` triggers the startup fail-fast guard (`assertProductionEnv()` via
  `apps/web/instrumentation.ts`). If a mandatory var is missing/invalid, the process **refuses
  to boot** — this is intended.
- Keep server-only: `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, all AI keys, all channel tokens.
- Never commit `.env.production`.

---

## 4. Required Environment Variables

### 4.1 Mandatory in production
The guard crashes startup if any of these is missing:
```env
NEXT_PUBLIC_APP_URL=https://app.tugobo.com      # must NOT be localhost/127.0.0.1
TUGOBO_AI_PROVIDER=deepseek                      # must NOT be "mock" in production
NODE_ENV=production
```

### 4.2 AI provider
The key matching `TUGOBO_AI_PROVIDER` is mandatory:
```env
DEEPSEEK_API_KEY=<key>
DEEPSEEK_MODEL=deepseek-chat
# DEEPSEEK_BASE_URL=https://api.deepseek.com   # optional override
```
> If you switch provider to `openai` / `claude` / `gemini`, the matching
> `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` becomes mandatory instead.

### 4.3 Supabase (mandatory)
```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
DATABASE_URL=postgresql://postgres:<pwd>@db.<project-ref>.supabase.co:5432/postgres
# SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # optional, server-only
```

### 4.4 Pilot hotel (mandatory)
Both must be set and **must match** the UUID of the pilot hotel row:
```env
PILOT_HOTEL_ID=<uuid>
NEXT_PUBLIC_PILOT_HOTEL_ID=<same-uuid>
```

### 4.5 Optional / future channels (safe to leave empty to boot)
```env
# ManyChat / Instagram bridge
MANYCHAT_BRIDGE_OUTBOUND_URL=
MANYCHAT_BRIDGE_TOKEN=
MANYCHAT_BRIDGE_SECRET=
MANYCHAT_OUTBOUND_INTERNAL_TOKEN=
# Twilio WhatsApp
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=
# Meta WhatsApp Cloud
META_WHATSAPP_PHONE_ID=
META_WHATSAPP_TOKEN=
META_WHATSAPP_VERIFY_TOKEN=
# Resend (email)
RESEND_API_KEY=
NOTIFICATION_EMAIL=team@tugobo.ai
# Langfuse (observability)
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=https://cloud.langfuse.com
# Inngest (durable workflows)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
# Public contact link
NEXT_PUBLIC_WHATSAPP_CONTACT=https://wa.me/<number>
```

> ⚠️ The mandatory set (§4.1–§4.4) is the exact list enforced by `assertProductionEnv()`:
> `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`,
> `NEXT_PUBLIC_APP_URL`, `TUGOBO_AI_PROVIDER`, `PILOT_HOTEL_ID`,
> `NEXT_PUBLIC_PILOT_HOTEL_ID` + the provider key.

---

## 5. Supabase Setup

1. **Create a production project** (separate from any local/dev instance). Pick an EU region
   (close to Turkey/guests).
2. **Collect credentials** → Project Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `DATABASE_URL` → Project Settings → Database → Connection string (use the **direct**
     `db.<ref>.supabase.co:5432` string).
3. **Apply schema before first start** — see **§6**. Choose the correct path:
   - **Fresh Supabase project** (new production DB): use `db:push` (§6.2, Path A).
   - **Existing Supabase project** (upgrading from pre-Sprint 23 schema): run 0001–0004 manually
     (§6.2, Path B).
   **Do NOT use `db:migrate`** — the Drizzle journal is absent; see §6.1.
4. **Seed the pilot hotel row** in the `hotels` table, then set `PILOT_HOTEL_ID` and
   `NEXT_PUBLIC_PILOT_HOTEL_ID` to that UUID (both must match).
5. **Auth callback URL** → Authentication → URL Configuration:
   - Site URL: `https://app.tugobo.com`
   - Redirect allow-list: `https://app.tugobo.com/auth/callback`
6. **RLS checks:** every business table is multi-tenant by `hotel_id`. Confirm **RLS is enabled**
   on all business tables and policies scope by `hotel_id`. Do not rely on the service-role key
   for normal request paths.

---

## 6. Database Migration Strategy

> **Read this section before running any database commands.** The migration tooling has a known
> constraint that makes `drizzle-kit migrate` unsafe for initial production deployment. Manual SQL
> execution is the required strategy until that constraint is resolved (see §6.3).

### Migration Status

Current state as of DEPLOY-5 inspection:

| Item | Status |
|---|---|
| `drizzle.config.ts` `out` path | ✅ Fixed — points to `packages/db/migrations/` (DEPLOY-3B) |
| Migration files `0001–0004` | ✅ Present in `packages/db/migrations/` |
| `packages/db/migrations/meta/_journal.json` | ❌ **Absent** — not committed |
| `pnpm --filter @tugobo/db db:migrate` | ❌ **Not authoritative** for initial production deployment |

**Root cause:** `drizzle-kit migrate` tracks applied migrations via a journal file
(`meta/_journal.json`). The four SQL files in this repo (`0001–0004`) are hand-authored and were
never processed by `drizzle-kit generate`, so no journal exists. Without a journal, `db:migrate`
has no record of what to apply and will silently apply nothing.

### Production Migration Strategy

> ⚠️ **INITIAL PRODUCTION DEPLOYMENT: Do NOT run `pnpm --filter @tugobo/db db:migrate`.**
> It will silently apply nothing and leave the production database missing required schema.

There are two paths depending on whether you are setting up a **fresh** Supabase project or
**upgrading an existing** one. Choose the correct path — do not mix them.

---

#### Path A — Fresh Supabase project (new production database, no prior schema)

> Use this path for the first VPS production deployment.

The 0001–0004 SQL files are **additive migrations** on top of a pre-existing base schema.
`0002` in particular contains `INSERT INTO connected_channels SELECT FROM channels`, which
requires a legacy `channels` table that does not exist in a fresh Supabase project. Running
0001–0004 on a blank database will fail at `0002`.

**Correct approach: use `drizzle-kit push`.** This creates the full current schema (the
post-migration end-state as defined in the Drizzle schema files) directly, without needing
the migration history:

```bash
# DATABASE_URL must be exported in the current shell
# drizzle-kit push may prompt for confirmation — type 'y' or press Enter to accept
pnpm --filter @tugobo/db db:push
```

After `db:push` completes, the database schema matches the Drizzle schema definitions exactly.
The 0001–0004 SQL files have already been applied (their changes are baked into the schema
definitions) — **do not run them again**.

---

#### Path B — Existing Supabase project (upgrading from pre-Sprint 23 schema)

> Use this path only if the target database already has the base tables (hotels, conversations,
> messages, contacts, channels) from an earlier version of the project.

Apply the four migrations **manually**, in numeric order:

**Option B-1 — psql**
```bash
# DATABASE_URL must be exported in the current shell
psql "$DATABASE_URL" -f packages/db/migrations/0001_sprint23_live_ops.sql
psql "$DATABASE_URL" -f packages/db/migrations/0002_multi_hotel_workspace_foundation.sql
psql "$DATABASE_URL" -f packages/db/migrations/0003_manychat_bridge_config.sql
psql "$DATABASE_URL" -f packages/db/migrations/0004_channel_connection_state.sql
```

**Option B-2 — Supabase SQL Editor**
Open each file in numeric order and paste its contents into the Supabase SQL editor, executing
one file at a time. Verify success before proceeding to the next file.

**Important notes:**
- Apply in strict numeric order (`0001` → `0002` → `0003` → `0004`). Later migrations may
  depend on schema introduced by earlier ones.
- Each SQL file uses `IF NOT EXISTS` / `IF EXISTS` guards where possible — re-running a file
  against an already-migrated schema is generally safe, but verify before re-applying.
- Do not skip or reorder files.

### Future Improvement

**Candidate task: DEPLOY-5C — Drizzle Migration Journal Generation**

To enable `pnpm --filter @tugobo/db db:migrate` for future deployments, a proper Drizzle
journal must be generated and committed:

1. Ensure `packages/db/migrations/` contains the finalized `0001–0004` SQL files.
2. Run `pnpm --filter @tugobo/db db:generate` against the current schema on a clean dev
   environment to produce `packages/db/migrations/meta/_journal.json` (and
   `meta/0000_snapshot.json`).
3. Commit the generated `meta/` directory alongside the existing SQL files.
4. Validate by running `pnpm --filter @tugobo/db db:migrate` against a staging Supabase project
   and confirming all four migrations are applied in order.

**This task is not required for pilot deployment.** Manual SQL execution via psql or the
Supabase SQL editor is safe, deterministic, and sufficient for the initial production go-live.
`db:migrate` automation can be added in a follow-up deployment sprint.

---

## 7. Build and Start

Run from `/var/www/tugobo-ai` with `.env.production` in place.

```bash
# 1. install (exact, reproducible)
pnpm install --frozen-lockfile

# 2. type-check gate
pnpm --filter web type-check

# 3. apply DB schema — see §6.2 for the correct path; do NOT use db:migrate
#
#    FRESH Supabase project (new production DB — use this for initial pilot deploy):
pnpm --filter @tugobo/db db:push
#
#    EXISTING Supabase project (upgrading from pre-Sprint 23 schema — use this if base tables exist):
# psql "$DATABASE_URL" -f packages/db/migrations/0001_sprint23_live_ops.sql
# psql "$DATABASE_URL" -f packages/db/migrations/0002_multi_hotel_workspace_foundation.sql
# psql "$DATABASE_URL" -f packages/db/migrations/0003_manychat_bridge_config.sql
# psql "$DATABASE_URL" -f packages/db/migrations/0004_channel_connection_state.sql

# 4. production build (forces 4 GB Node heap)
pnpm build

# 5. start under PM2
sudo npm install -g pm2
NODE_ENV=production pm2 start "pnpm --filter web start" --name tugobo-web --time

# 6. persist across reboots
pm2 save
pm2 startup systemd            # run the sudo command it prints, then:
pm2 save

# 7. log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
```

Day-to-day PM2:
```bash
pm2 status
pm2 logs tugobo-web
pm2 reload tugobo-web      # near-zero-downtime restart
pm2 restart tugobo-web
```

---

## 8. Nginx Configuration

`/etc/nginx/sites-available/app.tugobo.com`:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name app.tugobo.com;

    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.tugobo.com;

    # certbot --nginx fills in ssl_certificate / ssl_certificate_key (see §9)

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }
}
```
Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/app.tugobo.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. SSL Setup (Let's Encrypt / certbot)

```bash
sudo apt -y install snapd
sudo snap install core && sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# DNS for app.tugobo.com must resolve to the VPS first (see §10)
sudo certbot --nginx -d app.tugobo.com

# auto-renewal is a systemd timer; verify:
sudo certbot renew --dry-run
```

---

## 10. DNS Setup

Point `app.tugobo.com` at the VPS (Hostinger DNS / registrar):

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `app` | `<VPS_IPv4>` | 300 (raise after cutover) |
| AAAA | `app` | `<VPS_IPv6>` (if available) | 300 |

Verify before issuing SSL:
```bash
dig +short app.tugobo.com      # must return the VPS IP
```
> `tugobo.com` (marketing) and `lead.tugobo.com` (future lead engine) are **not** part of this
> runbook — do not point them at this VPS yet.

---

## 11. Smoke Tests

Run after deploy; all must pass:

1. **HTTPS + redirect** — `http://app.tugobo.com` → 301 → `https://app.tugobo.com`, valid cert.
2. **Login** — `https://app.tugobo.com/auth/login`, magic-link sign-in completes.
3. **App overview** — authenticated `/app/overview` (or dashboard) loads; unauthenticated access
   redirects to login.
4. **Conversations** — conversation views render with no missing-env crash.
5. **AI Yanıt Öner** — supervised AI reply action returns a suggestion.
6. **DeepSeek metadata** — the reply bubble metadata shows provider `deepseek` (not `mock`) with
   real timing.
7. **Multi-language response** — a guest message in DE/RU/EN gets a reply in the guest's language.
8. **Simulator hidden in production** — `POST /api/integrations/manychat/simulate-inbound`
   returns **404**.
9. **Env fail-fast** — on a staging boot, blank a mandatory var (e.g. `PILOT_HOTEL_ID`) and
   confirm the process refuses to start; restore it.

---

## 12. Rollback Plan

**Restart / inspect first:**
```bash
pm2 logs tugobo-web --lines 200
pm2 restart tugobo-web
```

**Roll back to the previous good commit:**
```bash
cd /var/www/tugobo-ai
git fetch origin
git log --oneline -5            # find the last known-good SHA
git checkout <good-sha>         # or: git reset --hard <good-sha>
pnpm install --frozen-lockfile
pnpm build
pm2 reload tugobo-web
```

**Logs:**
```bash
pm2 logs tugobo-web
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

> **Database:** migrations are additive — do **not** auto-rollback schema. If a migration broke
> production, restore from a Supabase backup / point-in-time and redeploy the matching code SHA.
> Before each deploy, note the current SHA so rollback is a 2-minute operation.

---

## 13. Known Limitations

- **Real Instagram not connected** — validated only via the ManyChat-style simulator (404 in prod).
- **Real WhatsApp not production-ready** — no live WhatsApp path yet.
- **Twilio webhook is a stub** — signature-validation pattern defined, not live. `/api/webhooks/twilio`
  is not production-trusted; it relies on `NEXT_PUBLIC_APP_URL` being the real HTTPS domain.
- **No rate limiting** — no app-level throttling on AI routes or webhooks. AI spend and DB load are
  unbounded; add Nginx `limit_req` on `/api/` before opening real channels.
- **Production Supabase required** — the app is RLS-enforced and multi-tenant; a misconfigured
  policy or service-role overuse risks cross-tenant exposure. It will not run against the dev
  instance in production.

---

## 14. Troubleshooting

**Env fail-fast crash at startup**
Symptom: process exits immediately with `Production environment validation failed: - Missing required production env: …`.
Fix: the named var(s) are missing/invalid in `.env.production`. Set all of §4.1–§4.4 + the provider
key. Note `TUGOBO_AI_PROVIDER=mock` and a localhost `NEXT_PUBLIC_APP_URL` are explicitly rejected.

**Migrations not applied / tables or columns missing**
Symptom: app starts but tables/columns are missing, queries fail, or schema errors appear in logs.

Possible cause 1 — `db:migrate` was used on a fresh Supabase project.
`0002` requires a legacy `channels` table; on a fresh DB it fails with
`relation "channels" does not exist`. See **§6.2, Path A**.
Fix: run `pnpm --filter @tugobo/db db:push` against the fresh database to create the full
current schema in one step.

Possible cause 2 — `drizzle-kit migrate` was run (journal absent).
The Drizzle journal (`meta/_journal.json`) is absent, so `db:migrate` silently applies nothing.
See **§6.1** for the full explanation.
Fix (existing Supabase / upgrade path): apply SQL manually in numeric order (see **§6.2, Path B**):
```bash
psql "$DATABASE_URL" -f packages/db/migrations/0001_sprint23_live_ops.sql
psql "$DATABASE_URL" -f packages/db/migrations/0002_multi_hotel_workspace_foundation.sql
psql "$DATABASE_URL" -f packages/db/migrations/0003_manychat_bridge_config.sql
psql "$DATABASE_URL" -f packages/db/migrations/0004_channel_connection_state.sql
```
Re-run is safe only if the SQL is idempotent — verify before re-applying. To enable `db:migrate`
in future deploys, complete DEPLOY-5C (§6.3).

**Nginx 502 Bad Gateway**
Cause: the Next.js process isn't listening on `127.0.0.1:3000`.
Fix: `pm2 status` / `pm2 logs tugobo-web`. Confirm the app booted (no env crash), then
`curl -I http://127.0.0.1:3000`. Reload Nginx after the app is up: `sudo systemctl reload nginx`.

**SSL issuance fails**
Cause: DNS not propagated, or port 80 blocked.
Fix: `dig +short app.tugobo.com` must return the VPS IP; `sudo ufw status` must allow 80/443.
Ensure the HTTP server block (§8) is live so the ACME HTTP-01 challenge can be served, then re-run
`sudo certbot --nginx -d app.tugobo.com`.

**DeepSeek provider unavailable**
Symptom: AI replies fail, or metadata shows `mock`/an error.
Fix: confirm `TUGOBO_AI_PROVIDER=deepseek` and `DEEPSEEK_API_KEY` are set and valid; check
outbound network to `https://api.deepseek.com` from the VPS (`curl -I https://api.deepseek.com`).
Inspect `pm2 logs tugobo-web` for the provider error.

**Supabase auth redirect fails**
Symptom: magic-link login bounces or lands on an error.
Fix: in Supabase → Authentication → URL Configuration, Site URL must be `https://app.tugobo.com`
and the redirect allow-list must include `https://app.tugobo.com/auth/callback`. Ensure
`NEXT_PUBLIC_APP_URL` matches exactly (https, no trailing slash mismatch).

---

_End of runbook._
