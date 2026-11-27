-- V14: Widen explanation_marks.note from VARCHAR(1000) to VARCHAR(10000).
--
-- Notes are now Markdown and are often pasted from AI answers, which easily
-- exceed 1000 characters; MarkService used to cut them off silently.
ALTER TABLE EXPLANATION_MARKS ALTER COLUMN NOTE SET DATA TYPE CHARACTER VARYING(10000);
