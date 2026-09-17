-- ============================================================
-- Live-session Reinforcement Bank integration — adds a nullable counter
-- to each session so the "Reinforcement" panel on the session-logging
-- page (src/components/reinforcement-session-panel.tsx) can record how
-- many times the selected mini-game's goal was reached during that one
-- session. Nullable/no-default so every session that predates this
-- feature (or where reinforcement was never expanded/used) just reads
-- as null rather than a misleading 0.
--
-- Deliberately not its own table: this is a per-session count, not a
-- log of individual reinforcement events, so a single column on the
-- existing sessions/teacher_sessions rows is enough (see the original
-- Reinforcement Bank spec, 0038_reinforcement_boards.sql, for the
-- boards themselves).
-- ============================================================

alter table public.sessions
  add column if not exists reinforcement_levels_cleared integer;

alter table public.teacher_sessions
  add column if not exists reinforcement_levels_cleared integer;
