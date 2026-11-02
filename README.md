# Wonder Courts — Management System (back office)

Back office for marketing, inventory and executive reporting (RCM v1.0, 2 Nov 2026).
**Not** a booking website: the existing booking site and LINE OA are not touched or connected.

Stack: Next.js 16 (App Router, server actions) · PostgreSQL (Neon in production) · `pg` · iron-session · zod · Lucide icons ·
Noto Sans Thai Looped (OFL, via Fontsource). Plain CSS design tokens in `app/globals.css`, calibrated to
`docs/MASTER_UI_REFERENCE.png`.

## Status (Phase P0 — Home visual gate)
- S01 Home Dashboard: PC / iPad / iPhone layouts, real database queries, today tasks (create / complete, audited),
  range filter (7/30/90 days), global search, notifications, source & freshness labels, role-limited cards.
- Auth: e-mail + scrypt password, encrypted HttpOnly session (8 h), session version for revocation, 5 failed logins / 15 min per IP.
- Other modules show an honest "not yet available" page (no mock data) until the Home visual gate is signed off.

## Run locally
```
pnpm install
cp .env.example .env.local     # DATABASE_URL, SESSION_SECRET (≥32 chars)
pnpm db:migrate
pnpm owner:create --email you@example.com --name "คุณ..."   # prints a one-time temporary password
pnpm dev
```
`node scripts/seed-demo.mjs` creates a separate **Demo**-labelled organization for visual QA; it refuses to run against any non-localhost database.

## Production (Vercel + Neon)
- Vercel project `wonder-courts` (team tanapatpusiri's projects), region `sin1`, Neon Postgres attached through the Vercel Neon integration (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`), plus `SESSION_SECRET`.
- Build command `pnpm vercel-build` runs `scripts/migrate.mjs` (each migration in its own transaction under an advisory lock, recorded in `schema_migrations`) **before** `next build`; a failed migration fails the deployment, so code never ships against an older schema. Migrations must stay additive/backward-compatible.
- First owner: set `SETUP_TOKEN` (≥24 chars) and open `/setup` once. The page returns 404 as soon as any user exists or when `SETUP_TOKEN` is unset; remove the variable afterwards.

## Tests
- `pnpm test` — unit tests: promotion calculator (RCM sample +435 THB / 6 h break-even), reorder planner (pack rounding, on-order, MOQ), KPI N/A guards, Bangkok date windows.
- `node tests/e2e/home.e2e.cjs` with `BASE`, `OWNER_EMAIL`, `OWNER_PASSWORD` — sign-in, forged cookie, persistence after reload, validation, search, 404, no horizontal overflow and ≥16px inputs at 375–1440 px, role restriction, sign-out.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## Data rules
Money in integer satang; business dates are `Asia/Bangkok` calendar days; Reach is never summed across platforms
(shown per platform, labelled as a sum of daily values); missing comparisons show **N/A**, never Infinity.
Every task / password change writes `audit_events` (who / what / before / after / when).
