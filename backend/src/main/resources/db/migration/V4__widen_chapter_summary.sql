-- V4: Widen chapters.summary from VARCHAR(1000) to CLOB.
--
-- The old VARCHAR(1000) limit rejected longer summaries (H2 error 22001).
-- Switch to CLOB so summaries are effectively unbounded, matching the other
-- long-text columns (excerpts.content, chapter_explanations.content).
ALTER TABLE CHAPTERS ALTER COLUMN SUMMARY CLOB;
