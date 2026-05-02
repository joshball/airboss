-- Worker liveness for hangar.job (chunk-6 review convergent worker fragility)
--
-- Adds `last_heartbeat_at` so an external probe or the /jobs UI can
-- distinguish "worker still polling" from "worker hung mid-handler". The
-- worker writes this column on every poll iteration; per-job heartbeats can
-- be added later without another schema change. Nullable because terminal
-- rows (queued/complete/failed/cancelled) have no live heartbeat to record;
-- callers must read "stuck" as `status = running AND now - last_heartbeat_at
-- > JOB_HEARTBEAT_STALE_MS`.

ALTER TABLE "hangar"."job" ADD COLUMN IF NOT EXISTS "last_heartbeat_at" timestamp with time zone;
