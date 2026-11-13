-- V11: Saved passages that no longer match the explanation text.
--
-- EXPLANATION_MARKS.ORPHANED is true when editing the explanation removed or changed
-- the passage's text, so it could not be found again. The row is kept (quote and note
-- intact) until the reader re-links or deletes it.

ALTER TABLE EXPLANATION_MARKS ADD COLUMN ORPHANED BOOLEAN DEFAULT FALSE NOT NULL;
