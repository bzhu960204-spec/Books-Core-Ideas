-- V13: Drop key ideas and excerpts.
--
-- A chapter is now read through its explanation only; the key ideas and excerpts
-- features (with the Idea / Excerpt Banks) were removed from the app. Back up the
-- data directory first (backup-data.ps1) if the old rows may still be wanted.
-- Dropping the tables also drops their indexes and their FKs to CHAPTERS (V9).

DROP TABLE IF EXISTS KEY_IDEAS;
DROP TABLE IF EXISTS EXCERPTS;
