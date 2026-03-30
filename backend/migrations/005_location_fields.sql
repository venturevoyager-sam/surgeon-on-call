-- ============================================================================
-- Migration 005: Add location fields to surgeons and hospitals tables
-- ============================================================================
-- Project : Surgeon on Call — Vaidhya Healthcare Pvt Ltd
-- Date    : 2026-03-29
-- Author  : Claude (AI-assisted)
--
-- Purpose :
--   1. Add lat/lng + location name to `surgeons` — the surgeon's preferred
--      operating location. Used for proximity-based matching and the GPS
--      tracking feature on surgery day.
--   2. Add lat/lng to `hospitals` — the hospital's physical location.
--      Used to calculate distance between surgeon and hospital for matching.
--   3. Add `bed_count` and `hospital_type` to `hospitals` — operational
--      metadata used for filtering and display in the admin dashboard.
--
-- Safety :
--   - Each ALTER uses an IF NOT EXISTS guard so the migration is idempotent.
--   - Safe to run multiple times without error.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Add location fields to `surgeons` table
-- ────────────────────────────────────────────────────────────────────────────
-- preferred_lat / preferred_lng: GPS coordinates of the surgeon's preferred
-- operating area. Nullable because existing surgeons won't have this yet —
-- it will be collected during onboarding or profile update.
--
-- preferred_location_name: Human-readable label for the location (e.g.
-- "Jubilee Hills, Hyderabad"). Displayed in the surgeon's profile and
-- used as a fallback when coordinates are unavailable.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'surgeons' AND column_name = 'preferred_lat'
  ) THEN
    ALTER TABLE surgeons ADD COLUMN preferred_lat FLOAT;
    RAISE NOTICE 'Added preferred_lat to surgeons';
  ELSE
    RAISE NOTICE 'preferred_lat already exists on surgeons — skipping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'surgeons' AND column_name = 'preferred_lng'
  ) THEN
    ALTER TABLE surgeons ADD COLUMN preferred_lng FLOAT;
    RAISE NOTICE 'Added preferred_lng to surgeons';
  ELSE
    RAISE NOTICE 'preferred_lng already exists on surgeons — skipping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'surgeons' AND column_name = 'preferred_location_name'
  ) THEN
    ALTER TABLE surgeons ADD COLUMN preferred_location_name TEXT;
    RAISE NOTICE 'Added preferred_location_name to surgeons';
  ELSE
    RAISE NOTICE 'preferred_location_name already exists on surgeons — skipping';
  END IF;
END
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Add location fields to `hospitals` table
-- ────────────────────────────────────────────────────────────────────────────
-- lat / lng: GPS coordinates of the hospital. Used to calculate distance
-- to surgeons for proximity-based matching and display on maps.
--
-- bed_count: Number of beds in the hospital. Operational metadata — helps
-- the admin team and surgeons understand the facility's scale.
--
-- hospital_type: Classification of the hospital. No check constraint —
-- validated at the application level. Expected values:
--   'private', 'corporate', 'nursing_home', 'clinic'

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'lat'
  ) THEN
    ALTER TABLE hospitals ADD COLUMN lat FLOAT;
    RAISE NOTICE 'Added lat to hospitals';
  ELSE
    RAISE NOTICE 'lat already exists on hospitals — skipping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'lng'
  ) THEN
    ALTER TABLE hospitals ADD COLUMN lng FLOAT;
    RAISE NOTICE 'Added lng to hospitals';
  ELSE
    RAISE NOTICE 'lng already exists on hospitals — skipping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'bed_count'
  ) THEN
    ALTER TABLE hospitals ADD COLUMN bed_count INTEGER;
    RAISE NOTICE 'Added bed_count to hospitals';
  ELSE
    RAISE NOTICE 'bed_count already exists on hospitals — skipping';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hospitals' AND column_name = 'hospital_type'
  ) THEN
    ALTER TABLE hospitals ADD COLUMN hospital_type TEXT;
    RAISE NOTICE 'Added hospital_type to hospitals';
  ELSE
    RAISE NOTICE 'hospital_type already exists on hospitals — skipping';
  END IF;
END
$$;


-- ============================================================================
-- Done! Summary of changes:
--   * surgeons.preferred_lat           FLOAT (nullable)
--   * surgeons.preferred_lng           FLOAT (nullable)
--   * surgeons.preferred_location_name TEXT  (nullable)
--   * hospitals.lat                    FLOAT   (nullable)
--   * hospitals.lng                    FLOAT   (nullable)
--   * hospitals.bed_count              INTEGER (nullable)
--   * hospitals.hospital_type          TEXT    (nullable, app-validated:
--       'private', 'corporate', 'nursing_home', 'clinic')
-- ============================================================================
