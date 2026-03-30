-- ============================================================================
-- Migration 001: Add request_type and fee columns to the cases table
-- ============================================================================
-- Project : Surgeon on Call — Vaidhya Healthcare Pvt Ltd
-- Date    : 2026-03-27
-- Author  : Claude (AI-assisted)
--
-- Purpose :
--   1. Add `request_type` column so hospitals can classify a case as
--      elective, emergency, OPD consultation, or reconsultation.
--   2. Add a single `fee` column (integer, paise) for flows where the
--      hospital sets a fixed fee instead of a min/max range.
--   3. Relax `fee_min` and `fee_max` to be NULLABLE, because emergency
--      and OPD cases may use the flat `fee` field instead of a range.
--
-- Safety  :
--   - Each ALTER uses IF NOT EXISTS or a DO $$ guard so the migration
--     is idempotent — safe to run multiple times without error.
--   - The NOT NULL constraint on request_type is added only AFTER all
--     existing rows are back-filled to 'elective', preventing check
--     constraint violations.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Add `request_type` column (nullable first, we'll tighten later)
-- ────────────────────────────────────────────────────────────────────────────
-- We add it as NULLABLE with a default so the column can be created even if
-- rows already exist. The NOT NULL constraint comes in step 1c.

DO $$
BEGIN
  -- 1a. Add the column if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_name = 'cases'
    AND    column_name = 'request_type'
  ) THEN
    ALTER TABLE cases
      ADD COLUMN request_type TEXT DEFAULT 'elective';

    RAISE NOTICE 'Added request_type column to cases table';
  ELSE
    RAISE NOTICE 'request_type column already exists — skipping ADD COLUMN';
  END IF;
END
$$;


-- 1b. Back-fill all existing rows that have a NULL request_type.
--     This is safe to run repeatedly — it only touches NULL rows.
UPDATE cases
SET    request_type = 'elective'
WHERE  request_type IS NULL;


-- 1c. Now that every row has a value, add the NOT NULL constraint.
--     We use a DO block to check first so it's idempotent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_name  = 'cases'
    AND    column_name = 'request_type'
    AND    is_nullable  = 'YES'
  ) THEN
    ALTER TABLE cases
      ALTER COLUMN request_type SET NOT NULL;

    RAISE NOTICE 'Set request_type to NOT NULL';
  ELSE
    RAISE NOTICE 'request_type is already NOT NULL — skipping';
  END IF;
END
$$;


-- 1d. Add a CHECK constraint to restrict allowed values.
--     The constraint name is explicit so we can check for its existence.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.check_constraints
    WHERE  constraint_name = 'cases_request_type_check'
  ) THEN
    ALTER TABLE cases
      ADD CONSTRAINT cases_request_type_check
      CHECK (request_type IN ('elective', 'emergency', 'opd', 'reconsult'));

    RAISE NOTICE 'Added CHECK constraint on request_type';
  ELSE
    RAISE NOTICE 'cases_request_type_check constraint already exists — skipping';
  END IF;
END
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Add `fee` column (integer, paise, nullable)
-- ────────────────────────────────────────────────────────────────────────────
-- This is a flat fee for request types (like emergency/OPD) where a
-- min/max range doesn't apply. Stored in paise to match the existing
-- fee_min / fee_max convention (e.g. ₹45,000 = 4500000 paise).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_name  = 'cases'
    AND    column_name = 'fee'
  ) THEN
    ALTER TABLE cases
      ADD COLUMN fee INTEGER;

    RAISE NOTICE 'Added fee column to cases table';
  ELSE
    RAISE NOTICE 'fee column already exists — skipping';
  END IF;
END
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Make fee_min NULLABLE
-- ────────────────────────────────────────────────────────────────────────────
-- Previously fee_min may have been NOT NULL. Emergency and OPD cases use the
-- flat `fee` column instead, so the range fields must accept NULL.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_name  = 'cases'
    AND    column_name = 'fee_min'
    AND    is_nullable  = 'NO'
  ) THEN
    ALTER TABLE cases
      ALTER COLUMN fee_min DROP NOT NULL;

    RAISE NOTICE 'Made fee_min nullable';
  ELSE
    RAISE NOTICE 'fee_min is already nullable (or does not exist) — skipping';
  END IF;
END
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Make fee_max NULLABLE
-- ────────────────────────────────────────────────────────────────────────────
-- Same reasoning as fee_min above.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_name  = 'cases'
    AND    column_name = 'fee_max'
    AND    is_nullable  = 'NO'
  ) THEN
    ALTER TABLE cases
      ALTER COLUMN fee_max DROP NOT NULL;

    RAISE NOTICE 'Made fee_max nullable';
  ELSE
    RAISE NOTICE 'fee_max is already nullable (or does not exist) — skipping';
  END IF;
END
$$;


-- ============================================================================
-- Done! Summary of changes:
--   • cases.request_type  TEXT NOT NULL DEFAULT 'elective'
--       CHECK (request_type IN ('elective','emergency','opd','reconsult'))
--   • cases.fee            INTEGER (nullable, stored in paise)
--   • cases.fee_min        now NULLABLE
--   • cases.fee_max        now NULLABLE
-- ============================================================================
