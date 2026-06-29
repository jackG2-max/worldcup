# Grey World Cup Predictions

An internal World Cup prediction league. Employees predict match scores before
kickoff; admins sync fixtures and final results from API-Football and approve
results to award points; a leaderboard ranks everyone.

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** for auth, Postgres and Row Level Security
- **API-Football** as the football data provider
- Deploys to **Vercel**

---

## How it works

1. User signs in.
2. User sees the matches and submits a score prediction for each.
3. Predictions are editable until kickoff, then **lock automatically**.
4. After a match ends an admin runs **Sync results** — scores land as
   _pending approval_ (no points yet).
5. Admin reviews and **approves** the result, which calculates points for every
   prediction on that match.
6. The leaderboard updates.

### Scoring

| Outcome | Points |
| --- | --- |
| Exact score | **10** |
| Correct winner / draw | **3** |
| + correct goal difference | **+2** |
| + correct total goals | **+1** |

Bonuses are only awarded when the winner/draw is also correct.

Worked example — actual result **Argentina 2 – 1 France**:

| Prediction | Points | Why |
| --- | --- | --- |
| 2 – 1 | 10 | exact score |
| 1 – 0 | 5 | correct winner (3) + goal difference (2) |
| 3 – 1 | 3 | correct winner only |
| France 1 – 2 Argentina (i.e. away win) | 0 | wrong winner |

> **Note on “maximum 13”.** The spec lists a 13-point maximum, but the rules as
> written can’t reach it: getting the outcome, goal difference _and_ total goals
> all correct means you’ve predicted the exact score, which is a flat 10. The
> realistic per-match ceiling is therefore **10**, and the implementation
> matches the four worked examples above exactly. The point values live in
> `src/lib/scoring.ts` if you want to change them.

---

## Project structure

```
.
├── middleware.ts                      # Supabase session refresh + route guard
├── supabase/migrations/0001_init.sql  # schema, RLS, triggers, leaderboard view
└── src/
    ├── app/
    │   ├── layout.tsx                 # nav shell
    │   ├── login/                     # email + password sign in / sign up
    │   ├── matches/                   # upcoming matches + prediction forms
    │   │   └── actions.ts             # submitPrediction server action
    │   ├── predictions/               # "my predictions"
    │   ├── leaderboard/
    │   ├── admin/                     # admin dashboard (admins only)
    │   ├── auth/signout/              # POST sign-out
    │   └── api/admin/                 # sync-fixtures / sync-results /
    │                                  #   approve-result / recalculate-points
    ├── components/                    # MatchCard, PredictionForm, Nav, admin/…
    └── lib/
        ├── api-football.ts            # server-side API-Football client
        ├── scoring.ts                 # pure scoring function
        ├── points.ts                  # idempotent per-match point calculation
        ├── match-state.ts             # open / locked / pending / approved
        ├── auth.ts                    # getAuth / requireAuth / requireAdmin
        ├── types.ts
        └── supabase/                  # client / server / admin / middleware
```

---

## 1. Supabase setup

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** → paste the contents of
   `supabase/migrations/0001_init.sql` → **Run**. This creates the
   `profiles`, `matches`, `predictions` tables, the `leaderboard_view`, all RLS
   policies and the triggers (including auto-creating a `profile` row on signup).
3. **Auth → Providers → Email**: keep **Email** enabled. For the simplest
   internal rollout, turn **Confirm email** _off_ (Auth → Providers → Email →
   “Confirm email”) so new accounts can sign in immediately. Leave it on if you
   prefer email confirmation — the login screen handles both.
4. (If you used the Supabase CLI instead, run `supabase db push`.)

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

| Variable | Where to find it | Exposed to browser? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | ❌ **server only** |
| `API_FOOTBALL_KEY` | API-Football dashboard | ❌ **server only** |
| `API_FOOTBALL_HOST` | `v3.football.api-sports.io` (direct) or `api-football-v1.p.rapidapi.com` (RapidAPI) | ❌ |
| `API_FOOTBALL_LEAGUE_ID` | `1` for the FIFA World Cup | ❌ |
| `API_FOOTBALL_SEASON` | e.g. `2026` | ❌ |

The service-role key and the API-Football key are **only ever read in
server-side code** (route handlers / server actions) — they are never sent to
the browser.

## 3. Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Create an account, then make yourself an admin
(below) and use the admin dashboard to **Sync fixtures**.

## 4. Make a user an admin

Sign up through the app first so the profile row exists, then in the Supabase
**SQL Editor**:

```sql
update public.profiles
set role = 'admin'
where email = 'you@grey.com';
```

(Regular users can’t change their own role — a trigger blocks role escalation,
so this must be done from the dashboard / service role.) Admins then see the
**Admin** link in the nav.

## 5. Deploy to Vercel

1. Push this repo to GitHub and **Import** it in Vercel.
2. Add every variable from `.env.local` to **Project → Settings → Environment
   Variables** (Production + Preview).
3. Add your Vercel URL to Supabase **Auth → URL Configuration → Redirect URLs /
   Site URL**.
4. Deploy. The admin API routes are server-only and run on Vercel functions.

### Keeping data fresh (optional)

The sync buttons are manual by design (admin-reviewed). To automate the pulls,
add a [Vercel Cron Job](https://vercel.com/docs/cron-jobs) that POSTs to
`/api/admin/sync-fixtures` and `/api/admin/sync-results`. Those routes currently
require an admin session; if you wire up cron, gate them with a shared secret
header instead and check it in the route handler.

---

## Admin workflow cheat-sheet

| Button | Endpoint | Effect |
| --- | --- | --- |
| Sync fixtures | `POST /api/admin/sync-fixtures` | Upsert fixtures (no dupes; predictions preserved) |
| Sync results | `POST /api/admin/sync-results` | Pull final scores → _pending approval_ |
| Approve | `POST /api/admin/approve-result` | Approve one result + award points (idempotent) |
| Recalculate points | `POST /api/admin/recalculate-points` | Re-score all approved results (idempotent) |

All point calculation is idempotent (points are **overwritten**, never
incremented), so re-running any action never double-counts.
