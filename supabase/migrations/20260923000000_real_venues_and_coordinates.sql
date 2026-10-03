-- Real venue registry used by the citizen app and operator dashboard.
-- Data is inserted by scripts/seed_supabase.py; clients never write directly.

CREATE TABLE IF NOT EXISTS public.venues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    venue TEXT NOT NULL,
    location_label TEXT NOT NULL,
    status TEXT NOT NULL,
    start_time TIMESTAMPTZ NULL,
    end_time TIMESTAMPTZ NULL,
    helpline TEXT NULL
);

CREATE TABLE IF NOT EXISTS public.venue_zones (
    id TEXT PRIMARY KEY,
    venue_id TEXT NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL
);

ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION NULL;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION NULL;

CREATE INDEX IF NOT EXISTS ix_venue_zones_venue_id ON public.venue_zones (venue_id);
CREATE INDEX IF NOT EXISTS ix_incidents_location ON public.incidents (location);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_all_anon_venues" ON public.venues;
CREATE POLICY "deny_all_anon_venues" ON public.venues FOR ALL TO anon USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "deny_all_auth_venues" ON public.venues;
CREATE POLICY "deny_all_auth_venues" ON public.venues FOR ALL TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "deny_all_anon_venue_zones" ON public.venue_zones;
CREATE POLICY "deny_all_anon_venue_zones" ON public.venue_zones FOR ALL TO anon USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "deny_all_auth_venue_zones" ON public.venue_zones;
CREATE POLICY "deny_all_auth_venue_zones" ON public.venue_zones FOR ALL TO authenticated USING (false) WITH CHECK (false);
