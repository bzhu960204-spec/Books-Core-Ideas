-- V10: Modelling details (DB-06).
--
--   * BOOKS.READING_STATUS stored "not set" two ways, '' and NULL; it is now always
--     NULL, so the column maps to a Java enum. CHECK constraints keep READING_STATUS
--     and STRUCTURE_TYPE to the enums' values (READING_STATUS NULL = not set).
--   * BOOK_REVIEWS.UPDATED_AT and CHAPTER_EXPLANATIONS.UPDATED_AT were DATEs, so
--     edits on the same day could not be ordered; they become TIMESTAMPs (existing
--     values: midnight of that day). The books' own dates (DATE_ADDED, START_DATE,
--     FINISH_DATE) are calendar dates and stay DATE.
--
-- H2 commits each DDL statement on its own: the guard below aborts, before anything
-- changes, if a value could not satisfy the new constraints.
-- (The alias keeps Flyway's log of the empty result from reading "aborted".)

SELECT CAST('V10 aborted: ' || COLUMN_NAME || ' has an unknown value ''' || V || ''' (' || N || ' rows)' AS INT)
       AS V10_CHECK_BOOK_VALUES
FROM (
    SELECT 'BOOKS.READING_STATUS' AS COLUMN_NAME, READING_STATUS AS V, COUNT(*) AS N FROM BOOKS
    WHERE READING_STATUS NOT IN ('WANT_TO_READ', 'READING', 'FINISHED', '') GROUP BY READING_STATUS
    UNION ALL
    SELECT 'BOOKS.STRUCTURE_TYPE', STRUCTURE_TYPE, COUNT(*) FROM BOOKS
    WHERE STRUCTURE_TYPE NOT IN ('CHAPTERS', 'PARTS') GROUP BY STRUCTURE_TYPE
);

UPDATE BOOKS SET READING_STATUS = NULL WHERE READING_STATUS = '';

ALTER TABLE BOOKS ADD CONSTRAINT CK_BOOKS_READING_STATUS
    CHECK (READING_STATUS IN ('WANT_TO_READ', 'READING', 'FINISHED'));
ALTER TABLE BOOKS ADD CONSTRAINT CK_BOOKS_STRUCTURE_TYPE
    CHECK (STRUCTURE_TYPE IN ('CHAPTERS', 'PARTS'));

ALTER TABLE BOOK_REVIEWS ALTER COLUMN UPDATED_AT SET DATA TYPE TIMESTAMP;
ALTER TABLE CHAPTER_EXPLANATIONS ALTER COLUMN UPDATED_AT SET DATA TYPE TIMESTAMP;
