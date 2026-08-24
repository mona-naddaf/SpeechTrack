# SpeechTrack

Next.js (App Router) + Supabase + Tailwind starter.

## What's here

- **Landing page** (`/`) — app name + "Sign in" button.
- **Auth** (`/login`) — a "Who's signing in today?" chooser (**SLP** / **Teacher** / **Parent**) rather than one generic sign-in. Parent goes straight to `/parent`'s access-code flow. SLP and Teacher both lead to the same email/password sign-in/sign-up form, framed for whichever was picked (icon, subtitle) — sign-up additionally asks "Are you a Speech-Language Pathologist or a Teacher?" as a required field alongside full name/email/password, which sets the account's **role**. After sign-in, routing always follows the account's actual stored role (not just which chooser button was clicked): SLP → `/dashboard`, Teacher → `/teacher/dashboard`.
- **Protected dashboard** (`/dashboard`) — SLP-only: redirects Teacher accounts to `/teacher/dashboard`, and redirects to `/login` if not authenticated (enforced in middleware *and* in the page itself). Greets the signed-in SLP by name ("Welcome, Mona") and lists their students with add/edit/delete. Any account without a name yet (pre-dating the full-name field) gets a one-time-per-login prompt to add it.
- **Teacher dashboard** (`/teacher/dashboard`) — placeholder for now ("Welcome, [name]! Your students will appear here."), guarded the same way: redirects SLP accounts to `/dashboard`, redirects to `/login` if not authenticated. No teacher-specific features beyond this yet — SLPs and Teachers are completely separate, never sharing students or data, just this same app shell/auth pattern.
- **Student detail** (`/students/[id]`) — name, class, and a **Goals** section (add/edit/delete, picking an area, optionally a bank goal — which can also prefill its default response format and target % — baseline, target %, response format, status).
- **Response formats** (`/toolkit/formats`) — view the SLP's response formats; full editor for the seeded **Cueing hierarchy** (rename, add/remove levels, change colors, toggle "independent"), plus **Correct/Incorrect** (rename, customize the two labels) and **Rating scale** (rename, set a custom min–max range); "+ New custom format" creates any of those three from scratch, and any format can be renamed or deleted (deletion is blocked with a clear message if a goal still uses it). Placeholder cards remain for the other, not-yet-built format types. Every format — built-in or custom — shows up as a selectable option anywhere a response format is picked (e.g. setting a goal), and session logging renders the right widget for its type (level buttons, a numeric rating row, or a Correct/Incorrect toggle with its custom labels).
- **Goal bank** (`/toolkit/goals`) — add, edit, and delete goals that aren't tied to any student yet (area, goal text, optional default response format, optional target %), grouped by area. These show up as pickable options in the "From goal bank" flow when setting a goal on a student.
- **Session logging** (`/students/[id]/session/new`) — "Start session" on the student page opens a live-tally logging screen: editable date, one card per active goal (colored level buttons for cueing-hierarchy goals, a numeric row for rating-scale goals, a Correct/Incorrect toggle — with custom labels if set — for everything else), an "Undo last" per card, and an optional note. Every tap auto-saves a trial immediately; "Save session" just finalizes the note/date and returns to the student page, which now lists past sessions (date + note, most recent first).
- **Progress & reports** (`/students/[id]/progress`, linked from "View progress" on the student page) — one card per goal (any status): for cueing-hierarchy goals, a level-percentage breakdown bar plus a "% independent over time" line chart; for rating-scale goals, a "% of max rating over time" chart; for everything else, a "% correct over time" chart (one point per session date). Each card shows total trial count, date range, and an auto-generated plain-language summary with a "Copy summary" button. Charts are hand-rolled inline SVG/CSS (no charting library) and render server-side — only the copy button ships client JS. "Export JSON backup" and "Export trials CSV" buttons on the student page download the student's full data client-side, no server round trip beyond the Supabase queries.
- **Home practice** (on the student page) — SLP-managed list of home-practice items (add/edit/delete), plus the student's **parent access code** with a copy button, plus a read-only **practice log** view of everything the parent has logged, where the SLP can leave a short praise note on any entry.
- **Parent view** (`/parent`, no Supabase login) — a parent types their child's 6-character access code to get in. Once in: the current home-practice items, a big-button form to log today's practice (checklist + 😄/🙂/😕 mood + optional note), and their practice history with any praise attached. Nothing else — no other student, no assessments/sessions/trials/charts. See **Parent access — security approach** below.
- **Assessment builder** (`/toolkit/assessments`) — build reusable assessments from scratch: name + description, then questions (prompt, response type — Correct/Incorrect, Transcription, or Free text — optional expected answer, optional notes), add/edit/delete/reorder (↑/↓). Always private to the owning SLP — no visibility/sharing option at all, unlike goals/response formats. An assessment can be renamed/deleted like the other toolkit resources, blocked with a clear message if it's already been run against a student.
- **Running an assessment** (from a student's page, "Run assessment" → `/students/[id]/assessment/[resultId]`) — pick one of her saved assessments to start a result; every question is answerable in any order (not forced sequential), each with the right input for its type (Correct/Incorrect toggle; a transcription text field plus an optional correct/approx/incorrect tag; a plain text field), auto-saving as she goes (immediately for toggles/tags, on blur for text) — matching the auto-save pattern from session logging. Shows a live "X/Y answered" progress bar. In-progress results are resumable from the student page. "Mark complete" locks it into a **read-only report**: every question with its full recorded answer (not just a score), a summary score (right_wrong + tagged-transcription answers only; free_text listed but unscored), and a "Copy report" button for a plain-text version. The student page lists both in-progress (resume) and completed (score + link to report) results.
- **`students` table** — see `supabase/migrations/0001_students.sql`.
- **`response_formats`, `areas`, `goals` tables** — see `supabase/migrations/0002_response_formats_and_goals.sql`. A Postgres trigger seeds every new account with a default "Cueing hierarchy" format and 10 default areas. Custom response formats and bank goals (`goals.student_id is null`) reuse these same tables/columns as-is — **no migration needed** for either feature.
- **`sessions`, `trials` tables** — see `supabase/migrations/0003_sessions_and_trials.sql`.
- **`students.parent_access_code`, `home_practice_items`, `practice_logs`, `praise` tables** — see `supabase/migrations/0004_home_practice_and_parent_access.sql`.
- **SLP full name** — stored in Supabase Auth's `user_metadata.full_name`, not a table column, so this also needed **no migration**. Set at sign-up (`src/app/login/page.tsx`), updatable via `supabase.auth.updateUser({ data: { full_name } })` (`src/app/dashboard/name-prompt-modal.tsx`), read on the dashboard via `user.user_metadata.full_name`.
- **Account role (SLP/Teacher)** — same pattern again: stored in Supabase Auth's `user_metadata.role`, **no migration needed**. `src/lib/role.ts`'s `getUserRole()` is the single source of truth for reading it — any account without a role set yet (pre-dating this field) defaults to `"slp"`, so no existing account/data breaks. Set at sign-up alongside full name; each protected dashboard route re-derives the role server-side and redirects to the other one if it doesn't match, rather than trusting which chooser button was clicked at `/login`.
- **`assessments`, `assessment_questions`, `assessment_results`, `assessment_answers` tables** — see `supabase/migrations/0005_assessments.sql`. **This one needs a migration** — these are new tables, unlike the three features above.
- **`assessments.kind`/`formality`, `assessment_areas` join table** — see `supabase/migrations/0006_assessment_metadata.sql`. **Also needs a migration.** `kind`/`formality` are nullable at the DB level (existing assessments just show "not set" until edited) even though the create form requires them going forward.

## Project structure

```
src/
  app/
    page.tsx                        landing page
    login/page.tsx                   SLP/Teacher/Parent chooser + sign in/sign up form (client component)
    dashboard/
      page.tsx                        protected SLP dashboard — student list (server component)
      students-section.tsx             student list UI + add/edit/delete state (client component)
      student-form-modal.tsx           add/edit student modal
      delete-confirm-modal.tsx         delete student confirmation
      sign-out-button.tsx              sign out button
      name-prompt-modal.tsx            one-time-per-login "add your name" prompt (client component)
    teacher/dashboard/
      page.tsx                        protected Teacher dashboard — placeholder (server component)
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
      assessments-section.tsx             in-progress/past assessment lists + "Run assessment" state (client component)
      run-assessment-modal.tsx            pick a saved assessment, creates an assessment_result
      assessment/[resultId]/
        page.tsx                        administer/report page (server component) — branches on result status
        assessment-administer.tsx         per-question inputs by type, auto-save, progress bar, "Mark complete" (client component)
        assessment-report.tsx             read-only report: every Q&A + summary score (server component)
        copy-report-button.tsx            clipboard button for the plain-text report
    toolkit/
      formats/
        page.tsx                        response formats settings page (server component)
        formats-list.tsx                 renders format cards (real + placeholder), create/edit/delete state (client component)
        new-format-modal.tsx             name + type picker for a brand-new custom format
        cueing-hierarchy-editor-modal.tsx rename + add/remove/rename/recolor levels editor
        correct-incorrect-editor-modal.tsx rename + custom correct/incorrect labels editor
        rating-scale-editor-modal.tsx    rename + custom min/max range editor
        delete-format-confirm-modal.tsx  delete format confirmation
      goals/
        page.tsx                        goal bank page (server component) — all bank goals, grouped by area
        goal-bank-section.tsx            bank goal list UI + add/edit/delete state (client component)
        bank-goal-form-modal.tsx         add/edit bank goal modal (area, text, default format, target %)
        delete-bank-goal-confirm-modal.tsx delete bank goal confirmation
      assessments/
        page.tsx                        assessment list page (server component)
        assessments-list.tsx             saved assessments list + create/delete state (client component)
        new-assessment-modal.tsx         name + description, creates and opens the editor
        delete-assessment-confirm-modal.tsx delete assessment confirmation
        [id]/
          page.tsx                        question editor page (server component)
          assessment-editor.tsx            name/description inline edit + question list + reorder state (client component)
          question-form-modal.tsx          add/edit question modal (prompt, response type, expected answer, notes)
          delete-question-confirm-modal.tsx delete question confirmation
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
    types.ts                        shared TypeScript types (Student, Goal, ResponseFormat, Session, Trial, HomePracticeItem, PracticeLog, Assessment, AssessmentQuestion, AssessmentResult, AssessmentAnswer, ...)
    colors.ts                       named color palette used by the cueing hierarchy editor
    response-format-types.ts         labels/descriptions for all response format types
    goal-status.ts                   labels/badge colors for goal status
    practice.ts                     shared "how it went" labels/emoji (great/okay/tricky) — SLP view and parent form both use it
    date.ts                         today's local date + display formatting for session/chart dates
    trial-value.ts                   human-readable rendering of a trial's jsonb value (CSV export)
    progress.ts                     per-goal aggregation: level breakdown, trend, trend direction, summary text
    assessment.ts                   response-type labels, answer formatting, scoring, plain-text report builder
    role.ts                         getUserRole() — single source of truth for SLP-vs-Teacher, defaults to "slp"
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
    0005_assessments.sql             assessments, assessment_questions, assessment_results, assessment_answers + RLS
    0006_assessment_metadata.sql     assessments.kind/formality + assessment_areas join table + RLS
```

As you add features, new pages go under `src/app/...` and shared logic under `src/lib/...`.

### Design system

Warm and friendly rather than clinical, since this is used by SLPs working with kids (and the `/parent` view is used directly by parents):

- **Color** — three custom Tailwind scales in `tailwind.config.ts`: `brand` (coral, primary actions/accents), `accent` (teal, secondary — links, "mastered" status, tags), `cream` (warm page background, `bg-cream-50`). Everything else uses Tailwind's built-in `stone` (warm neutral, replacing the default cool `slate`) for text/borders/surfaces. `red`/`green`/`amber` stay as the universal semantic colors for destructive actions, correct/incorrect, and warnings. The cueing-hierarchy level colors (`src/lib/colors.ts`) are unchanged — they were already soft/pastel Tailwind pairs and read fine alongside the new palette.
- **Type** — `next/font/google` in `src/app/layout.tsx`: **Baloo 2** (rounded, friendly) for all headings via a `@layer base` rule on `h1`-`h6` in `globals.css` (set once there rather than on every heading element), **Inter** for body text as the Tailwind `font-sans` default.
- **Shape & depth** — buttons/inputs `rounded-lg`, cards/modals `rounded-2xl`, pills `rounded-full`; cards carry `shadow-sm` with a `hover:shadow-md` lift, buttons add a subtle `hover:-translate-y-0.5` on top.
- **Icons** — [lucide-react](https://lucide.dev), used at nav links, section headings, empty states, and key action buttons (matched to what each button/section does — no icon components live in `src/lib/`, they're inlined per usage).
- **`src/components/`** — the one exception to "everything colocated under `src/app/...`": `assessment-meta-badges.tsx` is shared between the toolkit assessments list and the student-page "Run assessment" picker, so it's the first genuinely cross-route UI component.
- **Parent view extra warmth** — `/parent` leans further into the palette than the SLP-side pages: a soft gradient background, bigger/rounder mood-picker buttons with per-mood colors and a tactile `active:scale-95` press, and praise notes styled as a small celebration (gradient background, 🎉 icon) rather than a plain list item.

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
5. `supabase/migrations/0005_assessments.sql`
6. `supabase/migrations/0006_assessment_metadata.sql`

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
| `config`     | `jsonb`       | format-specific config: `{levels: [{name, color, is_independent}, ...]}` for `cueing_hierarchy`; `{min, max}` for `rating_scale`; `{correctLabel, incorrectLabel}` (both optional) for `correct_incorrect`; unused for the other, not-yet-built types |
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

**`assessments`** — a saved assessment template. Deliberately **no visibility/sharing column at all** — always private to the owning SLP, unlike `goals`/`response_formats`.

| column        | type          | notes               |
|---------------|---------------|-------------------------|
| `id`          | `uuid`        | primary key              |
| `slp_id`      | `uuid`        | owner                    |
| `name`        | `text`        | required                 |
| `description` | `text`        | optional                 |
| `created_at`  | `timestamptz` | auto-set on insert       |

**`assessment_questions`** — one row per question in an assessment. No `slp_id` column of its own — RLS checks ownership via `assessments.slp_id` (same pattern as `trials` → `sessions`).

| column             | type          | notes                                                    |
|--------------------|---------------|--------------------------------------------------------------|
| `id`               | `uuid`        | primary key                                                    |
| `assessment_id`    | `uuid`        | references `assessments`, `on delete cascade`                  |
| `order_index`      | `integer`     | display order; the editor's ↑/↓ swap adjacent values            |
| `prompt`           | `text`        | the question itself                                             |
| `response_type`    | `text`        | `right_wrong` \| `transcription` \| `free_text`                 |
| `expected_answer`  | `text`        | optional                                                         |
| `notes`            | `text`        | optional — admin notes, materials needed, etc.                  |
| `created_at`       | `timestamptz` | auto-set on insert                                               |

**`assessment_results`** — one row per time an assessment is run against a student. `assessment_id` has no `on delete cascade`: deleting an assessment template while results exist against it is blocked at the app layer with a clear message, and the DB reference is the backstop for that.

| column          | type          | notes                                     |
|-----------------|---------------|--------------------------------------------|
| `id`            | `uuid`        | primary key                                 |
| `slp_id`        | `uuid`        | owner                                       |
| `student_id`    | `uuid`        | references `students`, `on delete cascade`  |
| `assessment_id` | `uuid`        | references `assessments` (no cascade)       |
| `date`          | `date`        | defaults to today                           |
| `status`        | `text`        | `in_progress` \| `completed`                |
| `created_at`    | `timestamptz` | auto-set on insert                          |
| `completed_at`  | `timestamptz` | set when marked complete                    |

**`assessment_answers`** — one row per question per result, **upserted** as she answers/changes an answer (not appended like `trials`, which logs one row per tap) — a `unique(result_id, question_id)` constraint backs the upsert. No `slp_id` column of its own — RLS checks ownership via `assessment_results.slp_id`.

| column          | type          | notes                                                                 |
|-----------------|---------------|---------------------------------------------------------------------------|
| `id`            | `uuid`        | primary key                                                                 |
| `result_id`     | `uuid`        | references `assessment_results`, `on delete cascade`                       |
| `question_id`   | `uuid`        | references `assessment_questions`, `on delete cascade`                     |
| `response_type` | `text`        | copied from the question at answer time (same pattern as `trials.response_format_type`) |
| `value`         | `jsonb`       | `{"correct": true}` (right_wrong), `{"text": "...", "tag": "approx"}` (transcription), or `{"text": "..."}` (free_text) |
| `created_at`    | `timestamptz` | auto-set on insert                                                          |

An answer that's cleared back to empty is deleted rather than saved blank, so progress/answered counts stay accurate.

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
