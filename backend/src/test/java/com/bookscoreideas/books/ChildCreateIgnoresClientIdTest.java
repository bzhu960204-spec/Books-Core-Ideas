package com.bookscoreideas.books;

import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExcerptRepository;
import com.bookscoreideas.repository.KeyIdeaRepository;
import com.bookscoreideas.repository.PartRepository;
import com.bookscoreideas.support.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression for BUG-13 (BUG-09 for child resources): a create request carrying
 * another row's id must create a new row, never overwrite or move the existing one.
 */
class ChildCreateIgnoresClientIdTest extends IntegrationTest {

    @Autowired private ChapterRepository chapterRepository;
    @Autowired private PartRepository partRepository;
    @Autowired private KeyIdeaRepository ideaRepository;
    @Autowired private ExcerptRepository excerptRepository;
    @Autowired private TransactionTemplate tx;

    private long bookA;
    private long bookB;
    private long chapterA;
    private long chapterB;

    @BeforeEach
    void twoBooks() throws Exception {
        bookA = postForId("/api/books", Map.of("title", "A"));
        bookB = postForId("/api/books", Map.of("title", "B"));
        chapterA = postForId("/api/books/" + bookA + "/chapters", Map.of("title", "A1"));
        chapterB = postForId("/api/books/" + bookB + "/chapters", Map.of("title", "B1"));
    }

    @Test
    void chapter() throws Exception {
        long created = postForId("/api/books/" + bookB + "/chapters", Map.of(
                "id", chapterA, "title", "Hijack", "keyIdeas", List.of(Map.of("content", "smuggled"))));

        assertThat(created).isNotEqualTo(chapterA);
        tx.executeWithoutResult(s -> {
            var original = chapterRepository.findById(chapterA).orElseThrow();
            assertThat(original.getTitle()).isEqualTo("A1");
            assertThat(original.getBook().getId()).isEqualTo(bookA);
            assertThat(chapterRepository.findById(created).orElseThrow().getKeyIdeas()).isEmpty();
        });
        assertThat(ideaRepository.findAll()).noneMatch(i -> "smuggled".equals(i.getContent()));
    }

    @Test
    void part() throws Exception {
        long partA = postForId("/api/books/" + bookA + "/parts", Map.of("title", "Part A"));

        long created = postForId("/api/books/" + bookB + "/parts", Map.of("id", partA, "title", "Hijack"));

        assertThat(created).isNotEqualTo(partA);
        tx.executeWithoutResult(s -> {
            var original = partRepository.findById(partA).orElseThrow();
            assertThat(original.getTitle()).isEqualTo("Part A");
            assertThat(original.getBook().getId()).isEqualTo(bookA);
        });
    }

    @Test
    void idea() throws Exception {
        long ideaA = postForId("/api/chapters/" + chapterA + "/ideas", Map.of("content", "Idea A"));

        long created = postForId("/api/chapters/" + chapterB + "/ideas", Map.of("id", ideaA, "content", "Hijack"));

        assertThat(created).isNotEqualTo(ideaA);
        tx.executeWithoutResult(s -> {
            var original = ideaRepository.findById(ideaA).orElseThrow();
            assertThat(original.getContent()).isEqualTo("Idea A");
            assertThat(original.getChapter().getId()).isEqualTo(chapterA);
        });
    }

    @Test
    void excerpt() throws Exception {
        long excerptA = postForId("/api/chapters/" + chapterA + "/excerpts", Map.of("content", "Excerpt A"));

        long created = postForId("/api/chapters/" + chapterB + "/excerpts", Map.of("id", excerptA, "content", "Hijack"));

        assertThat(created).isNotEqualTo(excerptA);
        tx.executeWithoutResult(s -> {
            var original = excerptRepository.findById(excerptA).orElseThrow();
            assertThat(original.getContent()).isEqualTo("Excerpt A");
            assertThat(original.getChapter().getId()).isEqualTo(chapterA);
        });
    }
}
