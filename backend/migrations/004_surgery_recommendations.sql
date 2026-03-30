-- ============================================================================
-- Migration 004: Surgery recommendations table + parent_case_id on cases
-- ============================================================================
-- Project : Surgeon on Call — Surgeon on Call (OPC) Pvt Ltd
-- Date    : 2026-03-29
-- Author  : Claude (AI-assisted)
--
-- Purpose :
--   1. Create `surgery_recommendations` table — stores surgeon-initiated
--      procedure suggestions linked to a case. A surgeon reviewing a
--      re-consult or OPD case can recommend a follow-up surgery, which
--      the hospital can then accept (converting it into a new case) or
--      dismiss.
--   2. Add `parent_case_id` column to `cases` — links a new surgery case
--      back to the originating re-consult/OPD case that spawned it.
--      This creates a referral chain: reconsult → recommendation → new case.
--   3. Note the new 'converted' status value for cases (no DB constraint
--      exists — enforced at application level).
--
-- Safety :
--   - All DDL wrapped in IF NOT EXISTS / DO $$ guards for idempotency.
--   - Safe to run multiple times without error.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Create `surgery_recommendations` table
-- ────────────────────────────────────────────────────────────────────────────
-- Each row represents a surgeon's recommendation for a follow-up procedure
-- on an existing case. The hospital SPOC reviews these and can accept
-- (creating a new case) or dismiss them.
--
-- Columns:
--   id                   — unique identifier
--   case_id              — the case this recommendation is for (e.g. a re-consult)
--   surgeon_id           — the surgeon making the recommendation
--   suggested_procedure  — name of the recommended surgery/procedure
--   recommendation_notes — optional free-text clinical notes from the surgeon
--   urgency              — 'elective' or 'urgent' (surgeon's clinical judgement)
--   status               — 'pending' (awaiting hospital review),
--                          'accepted' (hospital created a new case from this),
--                          'dismissed' (hospital chose not to proceed)
--   created_at           — when the recommendation was made

CREATE TABLE IF NOT EXISTS surgery_recommendations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID        NOT NULL,
  surgeon_id            UUID        NOT NULL,
  suggested_procedure   TEXT        NOT NULL,
  recommendation_notes  TEXT,
  urgency               TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'pending',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign keys
  CONSTRAINT fk_recommendation_case
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_recommendation_surgeon
    FOREIGN KEY (surgeon_id) REFERENCES surgeons(id),

  -- Check constraints
  CONSTRAINT surgery_recommendations_urgency_check
    CHECK (urgency IN ('elective', 'urgent')),
  CONSTRAINT surgery_recommendations_status_check
    CHECK (status IN ('pending', 'accepted', 'dismissed'))
);


-- ────────────────────────────────────────────────────────────────────────────
-- 1b. Add indexes for common query patterns
-- ────────────────────────────────────────────────────────────────────────────
-- Hospital dashboard will query by case_id; surgeon history by surgeon_id.

CREATE INDEX IF NOT EXISTS idx_surgery_recommendations_case_id
  ON surgery_recommendations(case_id);

CREATE INDEX IF NOT EXISTS idx_surgery_recommendations_surgeon_id
  ON surgery_recommendations(surgeon_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Add `parent_case_id` column to the `cases` table
-- ────────────────────────────────────────────────────────────────────────────
-- Links a surgery case back to the originating case (e.g. a re-consult)
-- that led to a surgery recommendation. This creates a referral chain:
--
--   Re-consult case (parent) → recommendation → New surgery case (child)
--
-- ON DELETE SET NULL: if the parent case is deleted, the child case
-- remains valid — it just loses the link to its origin.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_name  = 'cases'
    AND    column_name = 'parent_case_id'
  ) THEN
    ALTER TABLE cases
      ADD COLUMN parent_case_id UUID;

    -- Add the foreign key constraint separately for clarity
    ALTER TABLE cases
      ADD CONSTRAINT fk_case_parent
      FOREIGN KEY (parent_case_id) REFERENCES cases(id) ON DELETE SET NULL;

    RAISE NOTICE 'Added parent_case_id column to cases table';
  ELSE
    RAISE NOTICE 'parent_case_id column already exists — skipping';
  END IF;
END
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Note on 'converted' case status
-- ────────────────────────────────────────────────────────────────────────────
-- There is NO check constraint on cases.status — allowed values are enforced
-- at the application level. The following status values are now valid:
--
--   draft, active, cascading, confirmed, in_progress,
--   completed, cancelled, unfilled, converted  ← NEW
--
-- 'converted' means a re-consult or OPD case has been turned into a full
-- surgery case via a surgeon's recommendation. The original case gets status
-- 'converted' and the new surgery case links back via parent_case_id.
--
-- No DDL needed — just ensuring this is documented for the team.


-- ============================================================================
-- Done! Summary of changes:
--   * NEW TABLE: surgery_recommendations
--       - id, case_id (FK→cases), surgeon_id (FK→surgeons),
--         suggested_procedure, recommendation_notes, urgency, status,
--         created_at
--       - CHECK: urgency IN ('elective', 'urgent')
--       - CHECK: status IN ('pending', 'accepted', 'dismissed')
--       - Indexes on case_id and surgeon_id
--   * cases.parent_case_id  UUID (nullable, FK→cases ON DELETE SET NULL)
--   * 'converted' noted as new valid case status (app-level, no constraint)
-- ============================================================================
