-- V2: Parts support (optional Part > Chapter grouping layer)
--
-- Idempotent like V1: uses IF EXISTS / IF NOT EXISTS so it no-ops on databases
-- where Hibernate ddl-auto=update already created the structures, and applies
-- cleanly on older databases.

-- Books gain a structure flag: "CHAPTERS" (default, legacy) or "PARTS".
ALTER TABLE IF EXISTS BOOKS ADD COLUMN IF NOT EXISTS STRUCTURE_TYPE VARCHAR(20) DEFAULT 'CHAPTERS';
UPDATE BOOKS SET STRUCTURE_TYPE = 'CHAPTERS' WHERE STRUCTURE_TYPE IS NULL;

-- Chapters gain an optional owning part (null for plain chapter books).
ALTER TABLE IF EXISTS CHAPTERS ADD COLUMN IF NOT EXISTS PART_ID BIGINT DEFAULT NULL;
