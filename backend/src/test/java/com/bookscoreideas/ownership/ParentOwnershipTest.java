package com.bookscoreideas.ownership;

import com.bookscoreideas.repository.ChapterImageRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExcerptRepository;
import com.bookscoreideas.repository.KeyIdeaRepository;
import com.bookscoreideas.repository.PartRepository;
import com.bookscoreideas.support.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression for BUG-05: a child resource addressed under the wrong parent
 * (e.g. /chapters/{otherChapter}/ideas/{id}) must be 404, not silently changed.
 */
class ParentOwnershipTest extends IntegrationTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};

    @Autowired private KeyIdeaRepository ideaRepository;
    @Autowired private ExcerptRepository excerptRepository;
    @Autowired private ChapterRepository chapterRepository;
    @Autowired private PartRepository partRepository;
    @Autowired private ChapterImageRepository imageRepository;

    private long bookA;
    private long bookB;
    private long chapterA;
    private long chapterB;

    @BeforeEach
    void createTwoBooks() throws Exception {
        bookA = postForId("/api/books", Map.of("title", "Owner A"));
        bookB = postForId("/api/books", Map.of("title", "Owner B"));
        chapterA = postForId("/api/books/" + bookA + "/chapters", Map.of("title", "A1"));
        chapterB = postForId("/api/books/" + bookB + "/chapters", Map.of("title", "B1"));
    }

    @Test
    void ideaUnderWrongChapterIs404AndUntouched() throws Exception {
        long ideaId = postForId("/api/chapters/" + chapterA + "/ideas", Map.of("content", "original"));

        mockMvc.perform(putRaw("/api/chapters/" + chapterB + "/ideas/" + ideaId, "{\"content\":\"hijacked\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/chapters/" + chapterB + "/ideas/" + ideaId))
                .andExpect(status().isNotFound());

        assertThat(ideaRepository.findById(ideaId)).get()
                .extracting(i -> i.getContent()).isEqualTo("original");

        mockMvc.perform(putRaw("/api/chapters/" + chapterA + "/ideas/" + ideaId, "{\"content\":\"edited\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("edited"));
    }

    @Test
    void excerptUnderWrongChapterIs404AndUntouched() throws Exception {
        long excerptId = postForId("/api/chapters/" + chapterA + "/excerpts", Map.of("content", "original"));

        mockMvc.perform(putRaw("/api/chapters/" + chapterB + "/excerpts/" + excerptId, "{\"content\":\"hijacked\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/chapters/" + chapterB + "/excerpts/" + excerptId))
                .andExpect(status().isNotFound());

        assertThat(excerptRepository.findById(excerptId)).get()
                .extracting(e -> e.getContent()).isEqualTo("original");
    }

    @Test
    void chapterUnderWrongBookIs404AndUntouched() throws Exception {
        mockMvc.perform(putRaw("/api/books/" + bookB + "/chapters/" + chapterA, "{\"title\":\"hijacked\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/books/" + bookB + "/chapters/" + chapterA))
                .andExpect(status().isNotFound());

        assertThat(chapterRepository.findById(chapterA)).get()
                .extracting(c -> c.getTitle()).isEqualTo("A1");
    }

    @Test
    void partUnderWrongBookIs404AndUntouched() throws Exception {
        long partA = postForId("/api/books/" + bookA + "/parts", Map.of("title", "PA"));

        mockMvc.perform(putRaw("/api/books/" + bookB + "/parts/" + partA, "{\"title\":\"hijacked\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/books/" + bookB + "/parts/" + partA))
                .andExpect(status().isNotFound());

        assertThat(partRepository.findById(partA)).get()
                .extracting(p -> p.getTitle()).isEqualTo("PA");
    }

    @Test
    void imageUnderWrongChapterIs404() throws Exception {
        String body = mockMvc.perform(multipart("/api/chapters/" + chapterA + "/images")
                        .file(new MockMultipartFile("files", "a.png", "image/png", PNG)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long imageId = objectMapper.readTree(body).get(0).get("id").asLong();

        mockMvc.perform(get("/api/chapters/" + chapterB + "/images/" + imageId + "/data"))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/chapters/" + chapterB + "/images/" + imageId))
                .andExpect(status().isNotFound());

        assertThat(imageRepository.existsById(imageId)).isTrue();
        mockMvc.perform(get("/api/chapters/" + chapterA + "/images/" + imageId + "/data"))
                .andExpect(status().isOk());
    }

    @Test
    void chapterCannotJoinAnotherBooksPart() throws Exception {
        long partOfB = postForId("/api/books/" + bookB + "/parts", Map.of("title", "PB"));

        mockMvc.perform(post("/api/books/" + bookA + "/chapters")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"A2\",\"partId\":" + partOfB + "}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(putRaw("/api/books/" + bookA + "/chapters/" + chapterA,
                        "{\"title\":\"A1\",\"partId\":" + partOfB + "}"))
                .andExpect(status().isBadRequest());

        assertThat(chapterRepository.findById(chapterA)).get()
                .extracting(c -> c.getPartId()).isNull();
    }

    private static MockHttpServletRequestBuilder putRaw(String url, String json) {
        return put(url).contentType(MediaType.APPLICATION_JSON).content(json);
    }
}
