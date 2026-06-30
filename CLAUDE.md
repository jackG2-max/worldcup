# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Internal World Cup prediction league for the company "Grey". Employees predict
match scores before kickoff; admins sync fixtures/results from API-Football and
approve results to award points; a leaderboard ranks everyone. Built this whole
app in one session — it is small, coherent, and the patterns below are applied
consistently, so match them rather than introducing new ones.

Stack: **Next.js 15 (App Router) + TypeScript + Tailwind v3 + Supabase
(auth/Postgres/RLS) + API-Football**, deployed on **Vercel**.

## Commands

```bash
npm run dev      # local dev (http://localhost:3000, or next free port)
npm run build    # prod build — this is the type-check + lint gate (no separate tsc/jest)
npm run lint     # eslint (next/core-web-vitals)
```

- **There are no unit tests.** "Verify it works" = `npm run build` passes, then a
  manual click-through. Don't claim tests exist.
- `npm run build` needs the Supabase/API env vars present (even dummy values) or
  it errors. Real values live in **`.env`** (NOT `.env.local` — the user put them
  in `.env`; `.env.local` holds only a Vercel OIDC token). Both are git-ignored.
- The Bash sandbox **cannot read `.env` secret values** (returns ENOENT by
  design). Don't try to source it; ask the user or use placeholders.

## Deployment

- GitHub: `jackG2-max/worldcup` (branch `main`). Git auto-deploy is **not**
  connected yet — deploys are manual via Vercel CLI.
- Vercel project: `cc37/worldcup_predictions`. Deploy with `vercel deploy --prod`.
  Prod URL: https://worldcuppredictions-two.vercel.app
- Env vars are set in the Vercel project (Production+Preview). `NEXT_PUBLIC_*` are
  baked in at build time, so they must exist before deploying.

## Database setup (manual, not automated)

`supabase/migrations/0001_init.sql` is **idempotent** and applied **by hand** in
the Supabase SQL editor (there's no `supabase` CLI wiring here). After schema
changes, re-running the whole file is the intended workflow.

Make a user admin (after they've signed up so their profile row exists):
```sql
update public.profiles set role = 'admin' where email = 'someone@grey.com';
```

## Architecture — the parts that need cross-file context

### Three Supabase clients, chosen by trust level (`src/lib/supabase/`)
- `client.ts` — browser (Client Components). Cookie-based session via `@supabase/ssr`.
- `server.ts` — RSC / Server Actions / Route Handlers. Acts **as the signed-in
  user**, so **RLS applies**. This is the default for reads.
- `admin.ts` — `createAdminClient()`, service role, **bypasses RLS**, server-only
  (throws if imported in browser). Used for privileged writes.

**Critical pattern for admin endpoints** (`src/app/api/admin/*`): verify the
caller with `getAdminOrNull()` (cookie client) → *then* do the work with
`createAdminClient()`. Never use the service-role client without that gate.

### RLS model (`0001_init.sql`) — non-obvious bits
- `is_admin()` is `SECURITY DEFINER` so it can read `profiles` from inside
  `profiles`' own policies without infinite recursion. Use it in policies.
- `predictions` insert/update policies enforce the **kickoff lock in SQL**
  (`exists(... matches.kickoff_at > now())`), not just in app code. A locked
  prediction can't be written even if app checks are bypassed.
- Point calculation writes `predictions.points` **after** kickoff — that only
  works because it runs through the **service-role** client (RLS bypassed).
- `leaderboard_view` is **intentionally NOT `security_invoker`** (owned by
  postgres → bypasses RLS), which is what lets every user read the *aggregated*
  standings while still being blocked from reading others' individual
  predictions. Don't "fix" this by adding `security_invoker`.
- `prevent_role_change()` trigger blocks role escalation **only when
  `auth.uid() is not null`** — privileged contexts (SQL editor, service-role key)
  have a null uid and are exempt, which is the only way to create the first admin.
  (An earlier version omitted this and silently blocked bootstrapping.)
- `handle_new_user()` trigger auto-creates a `profiles` row on signup, pulling
  `full_name`/`department` from `raw_user_meta_data`.

### The result/scoring flow
`sync-fixtures` (upsert on `api_match_id`, never duplicates, preserves
predictions) → `sync-results` (writes scores as **pending approval**, skips
already-approved matches, never scores) → `approve-result` (sets approved +
calculates points) → `recalculate-points` (re-scores all approved).

**Idempotency is structural**: points are **overwritten per prediction**, never
incremented (`src/lib/points.ts`). Re-running any admin action never
double-counts. Preserve this — don't introduce additive point updates.

### Scoring (`src/lib/scoring.ts`) — known spec discrepancy
Exact 10 / correct outcome 3 / +2 goal-difference / +1 total-goals, bonuses only
on a correct outcome. The spec says "max 13" but that's **unreachable**: getting
outcome+GD+total all right *is* an exact score (flat 10), so the real ceiling is
10. Implemented to match the spec's four worked examples (10/5/3/0). The
function is pure; point values are constants if rules need changing.

### Match state (`src/lib/match-state.ts`)
`getMatchState()` derives `open | locked | result_pending | result_approved`
from kickoff time + score presence + `result_approved`. UI badges and whether
the prediction form is editable both flow from this — change it here, not per page.

### Auth / routing
- `middleware.ts` (root) → `src/lib/supabase/middleware.ts`: refreshes the
  session cookie on every request AND guards routes (redirects unauthenticated
  users to `/login`; public prefixes are `/login`, `/auth`).
- Email + password auth (`src/app/login/LoginForm.tsx`). Sign-up writes
  `full_name`/`department` to user metadata. Magic-link is a possible alternative
  but not used.
- `src/lib/auth.ts`: `getAuth` / `requireAuth` / `requireAdmin` /
  `getAdminOrNull` — use these instead of re-querying the user/profile.

### Pages (all `force-dynamic`, server components fetch then render)
`/matches` (predict, with `submitPrediction` server action in
`src/app/matches/actions.ts`), `/predictions` (mine), `/leaderboard` (the view),
`/admin` (stats + sync/approve buttons; client actions in
`src/components/admin/`). Dates render via the `LocalTime` client component to
avoid SSR hydration mismatches.

## Conventions

- Path alias `@/*` → `src/*`.
- Supabase query results are typed by casting to the interfaces in
  `src/lib/types.ts` (no generated DB types).
- Tailwind v3 (not v4) with a small `brand` color extension.
