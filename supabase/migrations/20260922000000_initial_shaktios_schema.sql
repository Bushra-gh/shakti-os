-- ShaktiOS initial schema on Supabase PostgreSQL.
--
-- Faithful reproduction of the SQLAlchemy models in
-- services/api/src/shaktios_api/{event_store,incident_store,timeline_store}.py
-- plus one additive column (events.reporter_id, Phase 6: authenticated
-- citizen identity from Supabase Auth; NULL for anonymous/machine sources).
--
-- Notes on type mapping:
--   SQLAlchemy String   -> TEXT
--   SQLAlchemy Float    -> DOUBLE PRECISION
--   SQLAlchemy JSON     -> JSONB (wire-compatible with the SQLAlchemy JSON
--                          type; JSONB is the Supabase-idiomatic choice and
--                          supports indexing if needed later)
--   DateTime(timezone)  -> TIMESTAMPTZ
--   Status/severity are stored as TEXT (Python StrEnum only; no PG enums).
--   UUIDs are application-generated strings (uuid4), not PG uuid defaults.

-- ---------------------------------------------------------------------------
-- incidents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incidents (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    location TEXT NOT NULL,
    status TEXT NOT NULL,
    severity TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    risk DOUBLE PRECISION NOT NULL,
    factors JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    location TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    payload JSONB NOT NULL,
    incident_id TEXT NULL REFERENCES public.incidents (id),
    -- Additive (Phase 6): verified Supabase Auth user id (JWT sub) that
    -- submitted a citizen_report. NULL for anonymous reports and for
    -- machine signal sources (crowd simulator, civic-shield, vision).
    -- NEVER populated from client-supplied user ids.
    reporter_id TEXT NULL
);

-- ---------------------------------------------------------------------------
-- incident_timeline
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incident_timeline (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    type TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    details JSONB NOT NULL
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Pre-existing (from SQLAlchemy index=True):
CREATE INDEX IF NOT EXISTS ix_incident_timeline_incident_id
    ON public.incident_timeline (incident_id);

-- Additive, required for the existing queries to stay fast at scale:
--   correlate_event(): incidents(type, location, status, updated_at)
--   event -> incident join: events(incident_id)
--   list_events(): events(timestamp DESC)
--   reporter audit: events(reporter_id)
CREATE INDEX IF NOT EXISTS ix_incidents_correlation
    ON public.incidents (type, location, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_events_incident_id
    ON public.events (incident_id);
CREATE INDEX IF NOT EXISTS ix_events_location_timestamp
    ON public.events (location, timestamp DESC);
CREATE INDEX IF NOT EXISTS ix_events_reporter_id
    ON public.events (reporter_id);

-- ---------------------------------------------------------------------------
-- Row Level Security (Phase 7)
-- ---------------------------------------------------------------------------
-- Architecture: Expo -> Supabase Auth (identity only) -> FastAPI -> Postgres.
-- The Expo app MUST NOT read/write core tables directly. FastAPI connects
-- with a privileged role that bypasses RLS; anon/authenticated roles get
-- no access. These DENY policies are defense-in-depth.
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_all_anon_incidents" ON public.incidents;
CREATE POLICY "deny_all_anon_incidents" ON public.incidents
    FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_auth_incidents" ON public.incidents;
CREATE POLICY "deny_all_auth_incidents" ON public.incidents
    FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_anon_events" ON public.events;
CREATE POLICY "deny_all_anon_events" ON public.events
    FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_auth_events" ON public.events;
CREATE POLICY "deny_all_auth_events" ON public.events
    FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_anon_timeline" ON public.incident_timeline;
CREATE POLICY "deny_all_anon_timeline" ON public.incident_timeline
    FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_all_auth_timeline" ON public.incident_timeline;
CREATE POLICY "deny_all_auth_timeline" ON public.incident_timeline
    FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Storage (Phase 8: boundary only)
-- ---------------------------------------------------------------------------
-- Private bucket for future citizen photo evidence. There is NO backend
-- media endpoint yet; this bucket only reserves the Storage architecture.
-- Photos must NOT be publicly accessible by default.
INSERT INTO storage.buckets (id, name, public)
VALUES ('citizen-evidence', 'citizen-evidence', false)
ON CONFLICT (id) DO NOTHING;
