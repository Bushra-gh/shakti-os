-- Additive hardening only: no row deletion, backfill, role creation or ownership changes.
-- False permissive policies alone are ORed with other permissive policies and
-- therefore are not a reliable deny. Revoke table privileges AND install
-- restrictive policies for the client roles. The server's privileged connection
-- remains responsible for its own JWT/ownership checks.

REVOKE ALL ON TABLE public.incidents, public.events, public.incident_timeline,
    public.venues, public.venue_zones FROM anon, authenticated;

DROP POLICY IF EXISTS "client_boundary_incidents" ON public.incidents;
CREATE POLICY "client_boundary_incidents" ON public.incidents AS RESTRICTIVE
    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "client_boundary_events" ON public.events;
CREATE POLICY "client_boundary_events" ON public.events AS RESTRICTIVE
    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "client_boundary_timeline" ON public.incident_timeline;
CREATE POLICY "client_boundary_timeline" ON public.incident_timeline AS RESTRICTIVE
    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "client_boundary_venues" ON public.venues;
CREATE POLICY "client_boundary_venues" ON public.venues AS RESTRICTIVE
    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "client_boundary_zones" ON public.venue_zones;
CREATE POLICY "client_boundary_zones" ON public.venue_zones AS RESTRICTIVE
    FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Older installations may already have marked the initial migration applied.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reporter_id TEXT NULL;
-- Existing columns are untouched; align the actual listing/ownership queries.
CREATE INDEX IF NOT EXISTS ix_events_timestamp ON public.events (timestamp DESC);
CREATE INDEX IF NOT EXISTS ix_events_owned_reports
    ON public.events (reporter_id, timestamp DESC, id DESC) WHERE type = 'citizen_report';
CREATE INDEX IF NOT EXISTS ix_incidents_updated_at ON public.incidents (updated_at DESC);

-- The reserved evidence bucket must stay private even if it pre-existed the
-- original INSERT ... ON CONFLICT DO NOTHING. No stored object is removed.
UPDATE storage.buckets SET public = false WHERE id = 'citizen-evidence';
