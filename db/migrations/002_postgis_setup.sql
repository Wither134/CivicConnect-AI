-- CivicFix PostGIS Spatial Setup
-- Migration: 002_postgis_setup.sql

CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography columns for exact and coarsened geometry
ALTER TABLE reports ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(Point, 4326);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS geom_coarsened GEOGRAPHY(Point, 4326);

-- Populate geography columns from lat/lng
UPDATE reports
SET geom = ST_SetSRID(ST_MakePoint(exact_lng, exact_lat), 4326)::geography
WHERE exact_lat IS NOT NULL AND exact_lng IS NOT NULL;

UPDATE reports
SET geom_coarsened = ST_SetSRID(ST_MakePoint(coarsened_lng, coarsened_lat), 4326)::geography
WHERE coarsened_lat IS NOT NULL AND coarsened_lng IS NOT NULL;

-- Spatial GIST indexes
CREATE INDEX IF NOT EXISTS idx_reports_geom ON reports USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_reports_geom_coarsened ON reports USING GIST(geom_coarsened);

-- Trigger to auto-sync geometry on insert or update
CREATE OR REPLACE FUNCTION sync_report_geom()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.exact_lat IS NOT NULL AND NEW.exact_lng IS NOT NULL THEN
        NEW.geom := ST_SetSRID(ST_MakePoint(NEW.exact_lng, NEW.exact_lat), 4326)::geography;
    END IF;
    IF NEW.coarsened_lat IS NOT NULL AND NEW.coarsened_lng IS NOT NULL THEN
        NEW.geom_coarsened := ST_SetSRID(ST_MakePoint(NEW.coarsened_lng, NEW.coarsened_lat), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_report_geom ON reports;
CREATE TRIGGER trg_sync_report_geom
BEFORE INSERT OR UPDATE OF exact_lat, exact_lng, coarsened_lat, coarsened_lng
ON reports
FOR EACH ROW
EXECUTE FUNCTION sync_report_geom();

