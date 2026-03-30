-- ============================================================================
-- Migration 002: Add avg_hourly_rate column to surgeons table and seed values
-- ============================================================================
-- Project : Surgeon on Call — Surgeon on Call (OPC) Pvt Ltd
-- Date    : 2026-03-29
-- Author  : Claude (AI-assisted)
--
-- Purpose :
--   1. Add `avg_hourly_rate` column to the `surgeons` table so we can store
--      each surgeon's typical hourly rate. This is used for fee estimation
--      and display purposes.
--   2. Seed known rates for all existing surgeons in the platform.
--
-- Convention :
--   Values are stored in PAISE (₹1 = 100 paise) to match the existing fee
--   convention used in the `cases` table (fee, fee_min, fee_max).
--   Example: ₹8,00,000/hr → 80000000 paise.
--
-- Safety :
--   - The ALTER uses an IF NOT EXISTS guard so the migration is idempotent.
--   - Seed UPDATEs are keyed on surgeon UUID — safe to run multiple times;
--     they simply overwrite with the same value.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Add `avg_hourly_rate` column (integer, paise, nullable, no default)
-- ────────────────────────────────────────────────────────────────────────────
-- Nullable because not every surgeon will have a known rate yet. No default
-- so we don't accidentally assign a zero rate to new sign-ups.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_name  = 'surgeons'
    AND    column_name = 'avg_hourly_rate'
  ) THEN
    ALTER TABLE surgeons
      ADD COLUMN avg_hourly_rate INTEGER;

    RAISE NOTICE 'Added avg_hourly_rate column to surgeons table';
  ELSE
    RAISE NOTICE 'avg_hourly_rate column already exists — skipping ADD COLUMN';
  END IF;
END
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Seed avg_hourly_rate for existing surgeons
-- ────────────────────────────────────────────────────────────────────────────
-- Values below are provided in rupees in the comments. The actual UPDATE
-- stores rupees × 100 = paise.
--
-- Each UPDATE is a standalone statement keyed on the surgeon's UUID prefix
-- (using LIKE so we don't need the full UUID). This is idempotent — running
-- it again simply sets the same value.
--
-- Format: surgeon UUID prefix → name → ₹ rate → paise value

-- Dr. Sai Shiva Tadakamalla — ₹8,00,000 → 80000000 paise
UPDATE surgeons SET avg_hourly_rate = 80000000
WHERE id::text LIKE 'e4af9991%';

-- Dr. Adinarayan B. — ₹7,50,000 → 75000000 paise
UPDATE surgeons SET avg_hourly_rate = 75000000
WHERE id::text LIKE '6a0c8cb1%';

-- Dr. Tulasi Ram V. — ₹7,50,000 → 75000000 paise
UPDATE surgeons SET avg_hourly_rate = 75000000
WHERE id::text LIKE '6b9beb54%';

-- Dr. Karthik N.V.K.N. — ₹7,00,000 → 70000000 paise
UPDATE surgeons SET avg_hourly_rate = 70000000
WHERE id::text LIKE '7631ebfc%';

-- Dr. Krishna Chaitanya B. — ₹7,00,000 → 70000000 paise
UPDATE surgeons SET avg_hourly_rate = 70000000
WHERE id::text LIKE '08671f23%';

-- Dr. Sunil Bharat B.T. — ₹6,50,000 → 65000000 paise
UPDATE surgeons SET avg_hourly_rate = 65000000
WHERE id::text LIKE '5fb296a0%';

-- Dr. Samdhathri Dontaraju — ₹6,00,000 → 60000000 paise
UPDATE surgeons SET avg_hourly_rate = 60000000
WHERE id::text LIKE '3c4cefd8%';

-- Dr. Shiva Tadakamalla — ₹6,00,000 → 60000000 paise
UPDATE surgeons SET avg_hourly_rate = 60000000
WHERE id::text LIKE '3aab8716%';

-- Dr. Aravind Dindukurti — ₹6,00,000 → 60000000 paise
UPDATE surgeons SET avg_hourly_rate = 60000000
WHERE id::text LIKE '48be94dc%';

-- Dr. Divya Sai Narsingam — ₹5,50,000 → 55000000 paise
UPDATE surgeons SET avg_hourly_rate = 55000000
WHERE id::text LIKE 'b4334b53%';

-- Dr. Divya Narsingam — ₹5,50,000 → 55000000 paise
UPDATE surgeons SET avg_hourly_rate = 55000000
WHERE id::text LIKE '97fee770%';

-- Dr. Manasa Reddy Nalavolu — ₹5,00,000 → 50000000 paise
UPDATE surgeons SET avg_hourly_rate = 50000000
WHERE id::text LIKE 'ba25558b%';

-- Dr. Pooja Papisetty — ₹5,00,000 → 50000000 paise
UPDATE surgeons SET avg_hourly_rate = 50000000
WHERE id::text LIKE '0f9ba800%';

-- Dr. Thridhamna Sragwin — ₹4,50,000 → 45000000 paise
UPDATE surgeons SET avg_hourly_rate = 45000000
WHERE id::text LIKE '005b5237%';

-- Dr. Sragwin — ₹4,50,000 → 45000000 paise
UPDATE surgeons SET avg_hourly_rate = 45000000
WHERE id::text LIKE '01773e1c%';

-- Dr. Sushmitha Dongari — ₹4,50,000 → 45000000 paise
UPDATE surgeons SET avg_hourly_rate = 45000000
WHERE id::text LIKE '6d65579a%';

-- Dr. Rishith Bathini — ₹5,50,000 → 55000000 paise
UPDATE surgeons SET avg_hourly_rate = 55000000
WHERE id::text LIKE 'b9efcc19%';

-- Dr. Vedamsh Matety — ₹2,00,000 → 20000000 paise
UPDATE surgeons SET avg_hourly_rate = 20000000
WHERE id::text LIKE 'bf3c7a92%';


-- ============================================================================
-- Done! Summary of changes:
--   • surgeons.avg_hourly_rate  INTEGER (nullable, stored in paise)
--   • 18 surgeons seeded with their known hourly rates
-- ============================================================================
