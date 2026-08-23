# SpeechTrack

Next.js (App Router) + Supabase + Tailwind starter.

## What's here

- **Landing page** (`/`) — app name + "Sign in" button.
- **Auth** (`/login`) — email/password sign up and sign in via Supabase, toggle between the two modes. Sign out button lives on the dashboard.
- **Protected dashboard** (`/dashboard`) — redirects to `/login` if not authenticated (enforced in middleware *and* in the page itself). Lists the signed-in SLP's students with add/edit/delete.
- **Student detail** (`/students/[id]`) — name, class, and a **Goals** section (add/edit/delete, picking an area, optionally a bank goal, baseline, target %, response format, status).
- **Response formats** (`/toolkit/formats`) — view the SLP's response formats; full editor for the seeded **Cueing hierarchy** (rename levels, change colors, toggle "independent"); placeholder cards for the other format types (not editable yet).
- **Session logging** (`/students/[id]/session/new`) — "Start session" on the student page opens a live-tally logging screen: editable date, one card per active goal (colored level buttons for cueing-hierarchy goals, a Correct/Incorrect toggle for everything else), an "Undo last" per card, and an optional note. Every tap auto-saves a trial immediately; "Save session" just finalizes the note/date and returns to the student page, which now lists past sessions (date + note, most recent first).
- **Progress & reports** (`/students/[id]/progress`, linked from "View progress" on the student page) — one card per goal (any status): for cueing-hierarchy goals, a level-percentage breakdown bar plus a "% independent over time" line chart (one point per session date); for everything else, a "% correct over time" chart. Each card shows total trial count, date range, and an auto-generated plain-language summary with a "Copy summary" button. Charts are hand-rolled inline SVG/CSS (no charting library) and render server-side — only the copy button ships client JS. "Export JSON backup" and "Export trials CSV" buttons on the student page download the student's full data client-side, no server round trip beyond the Supabase queries.
- **Home practice** (on the student page) — SLP-managed list of home-practice items (add/edit/delete), plus the student's **parent access code** with a copy button, plus a read-only **practice log** view of everything the parent has logged, where the SLP can leave a short praise note on any entry.
- **Parent view** (`/parent`, no Supabase login) — a parent types their child's 6-character access code to get in. Once in: the current home-practice items, a big-button form to log today's practice (checklist + 😄/🙂/😕 mood + optional note), and their practice history with any praise attached. Nothing else — no other student, no assessments/sessions/trials/charts. See **Parent access — security approach** below.
- **`students` table** — see `supabase/migrations/0001_students.sql`.
- **`response_formats`, `areas`, `goals` tables** — see `supabase/migrations/0002_response_formats_and_goals.sql`. A Postgres trigger seeds every new account with a default "Cueing hierarchy" format and 10 default areas.
- **`sessions`, `trials` tables** — see `supabase/migrations/0003_sessions_and_trials.sql`.
- **`students.parent_access_code`, `home_practice_items`, `practice_logs`, `praise` tables** — see `supabase/migrations/0004_home_practice_and_parent_access.sql`.

## Project structure

```
src/
  app/
    page.tsx                        landing page
    login/page.tsx                   sign in / sign up form (client component)
    dashboard/
      page.tsx                        protected dashboard — student list (server component)
      students-section.tsx             student list UI + add/edit/delete state (client component)
      student-form-modal.tsx           add/edit student modal
      delete-confirm-modal.tsx         delete student confirmation
      sign-out-button.tsx              sign out button
    students/[id]/
      page.tsx                        student detail (server component) — goals + past sessions
      goals-section.tsx                goal list UI + add/edit/delete state (client component)
      goal-form-modal.tsx              add/edit goal modal
      delete-goal-confirm-modal.tsx    delete goal confirmation
      session/new/
        page.tsx                        new-session page (server component) — fetches active goals
        new-session-form.tsx             date/note state, auto-saves session + trials (client component)
        goal-trial-card.tsx              per-goal trial buttons + running tally + undo
      progress/
        page.tsx                        progress report (server component) — aggregates + renders per-goal cards
        level-breakdown-bars.tsx          cueing-hierarchy level % bars (server component)
        trend-chart.tsx                   hand-rolled inline SVG line chart (server component)
        copy-summary-button.tsx           clipboard button (client component — the only client JS on this page)
      export-buttons.tsx                 JSON backup + trials CSV downloads (client component)
      home-practice-section.tsx           SLP-side items list + add/edit/delete + parent code (client component)
      home-practice-item-form-modal.tsx    add/edit home practice item modal
      delete-home-practice-item-modal.tsx  delete home practice item confirmation
      copy-code-button.tsx                 clipboard button for the parent access code
      practice-log-section.tsx            SLP-side practice log view + leave-praise form (client component)
    toolkit/formats/
      page.tsx                        response formats settings page (server component)
      formats-list.tsx                 renders real + placeholder format cards (client component)
      cueing-hierarchy-editor-modal.tsx level name/color/independent editor
    parent/
      page.tsx                        reads the signed parent cookie server-side; login screen or dashboard
      parent-login-form.tsx             access-code entry (client component) — posts to /api/parent/login
      parent-dashboard.tsx              items + log-practice form + history (server component)
      log-practice-form.tsx             checklist + mood + note (client component) — posts to /api/parent/practice/log
      logout-button.tsx                 clears the parent cookie (client component)
    api/parent/
      login/route.ts                  validates the code, sets the signed cookie
      logout/route.ts                  clears the cookie
      practice/log/route.ts            writes a practice_logs row scoped to the cookie's student_id
    layout.tsx
    globals.css
  lib/
    types.ts                        shared TypeScript types (Student, Goal, ResponseFormat, Session, Trial, HomePracticeItem, PracticeLog, ...)
    colors.ts                       named color palette used by the cueing hierarchy editor
    response-format-types.ts         labels/descriptions for all response format types
    goal-status.ts                   labels/badge colors for goal status
    practice.ts                     shared "how it went" labels/emoji (great/okay/tricky) — SLP view and parent form both use it
    date.ts                         today's local date + display formatting for session/chart dates
    trial-value.ts                   human-readable rendering of a trial's jsonb value (CSV export)
    progress.ts                     per-goal aggregation: level breakdown, trend, trend direction, summary text
    parent-session.ts                signs/verifies the parent session cookie (HMAC-SHA256, no library)
    supabase/
      client.ts                     Supabase client for Client Components
      server.ts                     Supabase client for Server Components / Route Handlers
      service.ts                     service-role admin client — server-only, used only by src/app/api/parent/**
      middleware.ts                  session refresh + route protection logic (excludes /parent, /api/parent)
  middleware.ts                     wires middleware.ts into Next's request pipeline
supabase/
  migrations/
    0001_students.sql               students table + RLS policies
    0002_response_formats_and_goals.sql   response_formats, areas, goals tables + RLS + new-account seeding
    0003_sessions_and_trials.sql     sessions, trials tables + RLS
    0004_home_practice_and_parent_access.sql   parent_access_code + home_practice_items, practice_logs, praise + RLS
```

As you add features, new pages go under `src/app/...` and shared logic under `src/lib/...`.

Progress & Reports reads only from `sessions`/`trials`/`goals` — no new tables or migration needed, and no new npm dependency (charts are hand-rolled inline SVG/CSS rather than a charting library, to keep the bundle small and avoid another moving part).

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Supabase project credentials

Create a project at [supabase.com](https://supabase.com) (or use an existing one), then:

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with your project's URL and anon key, found in **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

The parent-facing flow needs two more values (see **Parent access — security approach** below for why):

```
# Project Settings -> API -> service_role (click "reveal"). Server-only —
# never prefix with NEXT_PUBLIC_.
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Not a Supabase credential — generate your own random value, e.g.:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
PARENT_SESSION_SECRET=...
```

### 3. Run the database migrations

In the Supabase dashboard, open **SQL Editor** and run, in order:

1. `supabase/migrations/0001_students.sql`
2. `supabase/migrations/0002_response_formats_and_goals.sql`
3. `supabase/migrations/0003_sessions_and_trials.sql`
4. `supabase/migrations/0004_home_practice_and_parent_access.sql`

(Or apply them with the Supabase CLI if you use one.)

**`students`**

| column       | type          | notes                              |
|--------------|---------------|-------------------------------------|
| `id`         | `uuid`        | primary key, auto-generated         |
| `slp_id`     | `uuid`        | owner — references `auth.users(id)` |
| `name`       | `text`        | student name                        |
| `class`      | `text`        | optional                            |
| `created_at` | `timestamptz` | auto-set on insert                  |

**`response_formats`**

| column       | type          | notes                                     |
|--------------|---------------|--------------------------------------------|
| `id`         | `uuid`        | primary key                                |
| `slp_id`     | `uuid`        | owner                                       |
| `name`       | `text`        | e.g. "Cueing hierarchy"                    |
| `type`       | `text`        | `cueing_hierarchy`, `correct_incorrect`, `rating_scale`, `pronunciation`, `open_text`, `behaviour_description`, `frequency_tally` |
| `config`     | `jsonb`       | format-specific config (levels, etc.)      |
| `created_at` | `timestamptz` | auto-set on insert                         |

**`areas`** — `id`, `slp_id`, `name`.

**`goals`**

| column                | type          | notes                                            |
|-----------------------|---------------|----------------------------------------------------|
| `id`                  | `uuid`        | primary key                                        |
| `slp_id`              | `uuid`        | owner                                              |
| `student_id`          | `uuid`        | nullable — **null means it's a goal-bank template**, not yet assigned |
| `area_id`             | `uuid`        | references `areas`                                 |
| `text`                | `text`        | the goal itself                                    |
| `response_format_id`  | `uuid`        | nullable, references `response_formats`            |
| `baseline`            | `text`        | optional, free-form                                |
| `target_percent`      | `integer`     | optional, 0–100                                    |
| `status`               | `text`        | `active` \| `on_hold` \| `mastered`                |
| `created_at`          | `timestamptz` | auto-set on insert                                 |

**`sessions`**

| column       | type          | notes                                     |
|--------------|---------------|--------------------------------------------|
| `id`         | `uuid`        | primary key                                |
| `slp_id`     | `uuid`        | owner                                      |
| `student_id` | `uuid`        | references `students`                      |
| `date`       | `date`        | defaults to today, editable                |
| `note`       | `text`        | optional                                   |
| `created_at` | `timestamptz` | auto-set on insert                         |

**`trials`** — one row per tap during a session.

| column                 | type          | notes                                                       |
|------------------------|---------------|---------------------------------------------------------------|
| `id`                   | `uuid`        | primary key                                                    |
| `session_id`           | `uuid`        | references `sessions`                                          |
| `goal_id`               | `uuid`        | references `goals`                                             |
| `response_format_type` | `text`        | copied from the goal's response format at the time of the trial |
| `value`                | `jsonb`       | shape depends on the format, e.g. `{"level": "Spontaneous"}` or `{"correct": true}` |
| `created_at`           | `timestamptz` | auto-set on insert                                             |

`trials` has no `slp_id` column of its own — its RLS policies check ownership through the parent `sessions` row (`sessions.slp_id = auth.uid()`) instead.

Row Level Security is enabled on every table, scoped to `slp_id = auth.uid()` (directly, or via the parent session for `trials`) — an SLP only ever sees their own rows, matching the `students` table pattern.

**New-account seeding:** a `handle_new_user()` trigger fires on every new Supabase Auth signup and inserts a default "Cueing hierarchy" response format (5 levels: Spontaneous/green, Visual support/teal, Verbal support/amber, After modeling/clay, No answer/grey) plus the 10 default areas (Speech sounds, Articulation, Phonology, Receptive language, Expressive language, Fluency, Voice, Pragmatics/Social, Literacy, AAC). The migration also backfills these defaults for any account that already existed before it ran.

**`students.parent_access_code`** — a 6-character code (uppercase letters + digits, excluding 0/O/1/I/L to avoid confusion) auto-generated by a trigger on insert, backfilled for existing students, unique.

**`home_practice_items`** — SLP-managed, normal `slp_id` RLS.

| column             | type          | notes                       |
|--------------------|---------------|-------------------------------|
| `id`               | `uuid`        | primary key                    |
| `slp_id`           | `uuid`        | owner                          |
| `student_id`       | `uuid`        | references `students`          |
| `what_to_practice` | `text`        | required                       |
| `how_to_practice`  | `text`        | optional                       |
| `last_worked_date` | `date`        | optional; bumped automatically when a parent logs practice against this item |
| `created_at`       | `timestamptz` | auto-set on insert             |

**`practice_logs`** — written only by parents, through the service-role API route (see below); read by SLPs through normal RLS via a join to `students.slp_id`. No `slp_id` column of its own, and deliberately no insert/update/delete RLS policy for the authenticated role.

| column         | type          | notes                                                      |
|----------------|---------------|---------------------------------------------------------------|
| `id`           | `uuid`        | primary key                                                    |
| `student_id`   | `uuid`        | references `students`                                          |
| `date`         | `date`        | defaults to today                                              |
| `activities`   | `jsonb`       | array of `{id, text}` snapshots of the items practiced — text is captured at log time so history survives an item later being edited/deleted |
| `how_it_went`  | `text`        | `great` \| `okay` \| `tricky`                                  |
| `note`         | `text`        | optional                                                       |
| `created_at`   | `timestamptz` | auto-set on insert                                             |

**`praise`** — SLP notes on a log entry. RLS checks ownership via `practice_logs` → `students.slp_id`.

| column            | type          | notes                          |
|-------------------|---------------|-----------------------------------|
| `id`              | `uuid`        | primary key                        |
| `practice_log_id` | `uuid`        | references `practice_logs`         |
| `message`         | `text`        | required                           |
| `created_at`      | `timestamptz` | auto-set on insert                 |

### Parent access — security approach

Parents never get a Supabase Auth account, so RLS (which is keyed entirely on `auth.uid()`) can't scope their access the normal way. Instead:

1. `POST /api/parent/login` checks the typed code against `students.parent_access_code` using a **service-role Supabase client** (`src/lib/supabase/service.ts` — bypasses RLS, server-only, never imported into client code), then sets an **httpOnly cookie** containing the student's ID, signed with HMAC-SHA256 (`src/lib/parent-session.ts`, no external library) so it can't be tampered with to view a different student.
2. Every other parent-facing route/page re-verifies that signed cookie and derives `student_id` **only from it** — never from anything in the request body — before touching the database.
3. `home_practice_items` stays under the normal `slp_id`-based RLS the rest of the app uses. `practice_logs`/`praise` are readable/writable by the SLP through normal RLS too (via a join to `students`), but are only ever *written* by parents through the service-role route.
4. `src/middleware.ts` excludes `/parent` and `/api/parent` entirely — that flow has nothing to do with Supabase Auth sessions and shouldn't touch that code path.

**Trade-off:** this moves enforcement from the database (safe regardless of application bugs) into that route-handler code (a bug there could leak across students, since the service key ignores RLS). Known limitations, accepted for simplicity: no rate-limiting/lockout on the login endpoint (a 6-character code from a 32-symbol alphabet is ~1 billion combinations, but nothing throttles repeated guesses), and no CSRF token on the log-practice submission (mitigated by `SameSite=Lax`, but not airtight — worst case is a forged log entry, not a data leak, since reading data still requires the code).

### 4. Email confirmation

By default Supabase requires email confirmation before a new user can sign in. For local testing you can turn this off in **Authentication → Providers → Email → Confirm email**, or just confirm via the email link.

### 5. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`.
