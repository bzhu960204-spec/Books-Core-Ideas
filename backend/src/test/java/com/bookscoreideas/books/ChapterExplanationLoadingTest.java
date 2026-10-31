package com.bookscoreideas.books;

import com.bookscoreideas.entity.ChapterExplanation;
import com.bookscoreideas.repository.ChapterExplanationRepository;
import com.bookscoreideas.support.IntegrationTest;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * DB-06: chapters no longer map their explanation (an inverse one-to-one, which
 * Hibernate cannot load lazily without bytecode enhancement), so loading a chapter
 * no longer drags the explanation's full text along. The database's ON DELETE
 * CASCADE (V9) removes the explanation with its chapter instead of JPA.
 */
class ChapterExplanationLoadingTest extends IntegrationTest {

    @Autowired private EntityManagerFactory entityManagerFactory;
    @Autowired private ChapterExplanationRepository explanationRepository;

    @Test
    void chapterWritesDoNotLoadTheExplanation() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Explained"));
        long chapter = postForId("/api/books/" + book + "/chapters", Map.of("title", "C1"));
        putJson("/api/chapters/" + chapter + "/explanation", Map.of("content", "<p>" + "long text ".repeat(500) + "</p>"));

        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        putJson("/api/books/" + book + "/chapters/" + chapter, Map.of("title", "C1 renamed"));
        postForId("/api/chapters/" + chapter + "/ideas", Map.of("content", "idea"));
        postForId("/api/chapters/" + chapter + "/excerpts", Map.of("content", "excerpt"));

        assertThat(stats.getEntityStatistics(ChapterExplanation.class.getName()).getLoadCount()).isZero();
    }

    // Characterisation: holds with the JPA cascade (before) and the database cascade (after).
    @Test
    void deletingAChapterOrBookStillRemovesTheExplanation() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Explained twice"));
        long first = postForId("/api/books/" + book + "/chapters", Map.of("title", "C1"));
        long second = postForId("/api/books/" + book + "/chapters", Map.of("title", "C2"));
        putJson("/api/chapters/" + first + "/explanation", Map.of("content", "<p>one</p>"));
        putJson("/api/chapters/" + second + "/explanation", Map.of("content", "<p>two</p>"));

        mockMvc.perform(delete("/api/books/" + book + "/chapters/" + first)).andExpect(status().isNoContent());
        assertThat(explanationRepository.findByChapterId(first)).isEmpty();
        assertThat(explanationRepository.findByChapterId(second)).isPresent();

        mockMvc.perform(delete("/api/books/" + book)).andExpect(status().isNoContent());
        assertThat(explanationRepository.findByChapterId(second)).isEmpty();
    }
}
