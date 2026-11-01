package com.bookscoreideas.deletion;

import com.bookscoreideas.repository.BookCollectionItemRepository;
import com.bookscoreideas.repository.BookCollectionRepository;
import com.bookscoreideas.repository.BookReviewRepository;
import com.bookscoreideas.repository.ChapterImageRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExplanationMarkRepository;
import com.bookscoreideas.repository.ReadingBookmarkRepository;
import com.bookscoreideas.service.ChapterImageStorage;
import com.bookscoreideas.support.IntegrationTest;
import tools.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regressions for BUG-02 (book with reviews), BUG-03 (chapter with images) and
 * BUG-08 (collection memberships left behind): these deletes used to fail with
 * 500 on foreign keys or leave orphaned rows/files.
 */
class DeletionCascadeTest extends IntegrationTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};

    @Autowired private ChapterImageStorage storage;
    @Autowired private ChapterImageRepository imageRepository;
    @Autowired private ChapterRepository chapterRepository;
    @Autowired private BookReviewRepository reviewRepository;
    @Autowired private ReadingBookmarkRepository bookmarkRepository;
    @Autowired private ExplanationMarkRepository markRepository;
    @Autowired private BookCollectionItemRepository collectionItemRepository;
    @Autowired private BookCollectionRepository collectionRepository;

    @Test
    void deletingBookWithReviewSucceeds() throws Exception {
        long bookId = postForId("/api/books", Map.of("title", "Book with review"));
        long reviewId = postForId("/api/books/" + bookId + "/reviews", Map.of("title", "r", "content", "c"));

        mockMvc.perform(delete("/api/books/" + bookId)).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/books/" + bookId)).andExpect(status().isNotFound());
        assertThat(reviewRepository.existsById(reviewId)).isFalse();
    }

    @Test
    void deletingChapterWithImageRemovesRowAndFile() throws Exception {
        long bookId = postForId("/api/books", Map.of("title", "Book with image"));
        long chapterId = postForId("/api/books/" + bookId + "/chapters", Map.of("title", "C1"));
        JsonNode image = uploadImage(chapterId);
        Path file = imageFile(image);

        mockMvc.perform(delete("/api/books/" + bookId + "/chapters/" + chapterId)).andExpect(status().isNoContent());

        assertThat(chapterRepository.existsById(chapterId)).isFalse();
        assertThat(imageRepository.existsById(image.get("id").asLong())).isFalse();
        assertThat(file).doesNotExist();
    }

    @Test
    void deletingPartRemovesItsChaptersAndImageFiles() throws Exception {
        long bookId = postForId("/api/books", Map.of("title", "Parts book", "structureType", "PARTS"));
        long partId = postForId("/api/books/" + bookId + "/parts", Map.of("title", "P1"));
        long chapterId = postForId("/api/books/" + bookId + "/chapters", Map.of("title", "C1", "partId", partId));
        Path file = imageFile(uploadImage(chapterId));

        mockMvc.perform(delete("/api/books/" + bookId + "/parts/" + partId)).andExpect(status().isNoContent());

        assertThat(chapterRepository.existsById(chapterId)).isFalse();
        assertThat(file).doesNotExist();
    }

    @Test
    void deletingSingleImageRemovesItsFile() throws Exception {
        long bookId = postForId("/api/books", Map.of("title", "Single image"));
        long chapterId = postForId("/api/books/" + bookId + "/chapters", Map.of("title", "C1"));
        JsonNode image = uploadImage(chapterId);
        Path file = imageFile(image);

        mockMvc.perform(delete("/api/chapters/" + chapterId + "/images/" + image.get("id").asLong()))
                .andExpect(status().isNoContent());

        assertThat(imageRepository.existsById(image.get("id").asLong())).isFalse();
        assertThat(file).doesNotExist();
    }

    @Test
    void deletingFullyPopulatedBookRemovesEverythingItOwns() throws Exception {
        long bookId = postForId("/api/books", Map.of("title", "Full book", "structureType", "PARTS"));
        long partId = postForId("/api/books/" + bookId + "/parts", Map.of("title", "P1"));
        long chapterId = postForId("/api/books/" + bookId + "/chapters", Map.of("title", "C1", "partId", partId));
        postForId("/api/chapters/" + chapterId + "/ideas", Map.of("content", "idea"));
        postForId("/api/chapters/" + chapterId + "/excerpts", Map.of("content", "excerpt"));
        putJson("/api/chapters/" + chapterId + "/explanation", Map.of("content", "<p>explanation</p>"));
        long bookmarkId = postForId("/api/chapters/" + chapterId + "/bookmarks", Map.of("scrollRatio", 0.5));
        long markId = postForId("/api/chapters/" + chapterId + "/marks", Map.of("quote", "explanation"));
        long reviewId = postForId("/api/books/" + bookId + "/reviews", Map.of("title", "r", "content", "c"));
        Path file = imageFile(uploadImage(chapterId));
        long collectionId = postForId("/api/book-collections", Map.of("name", "Shelf " + bookId));
        mockMvc.perform(post("/api/book-collections/" + collectionId + "/books/" + bookId))
                .andExpect(status().is2xxSuccessful());

        mockMvc.perform(delete("/api/books/" + bookId)).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/books/" + bookId)).andExpect(status().isNotFound());
        assertThat(chapterRepository.existsById(chapterId)).isFalse();
        assertThat(reviewRepository.existsById(reviewId)).isFalse();
        assertThat(bookmarkRepository.existsById(bookmarkId)).isFalse();
        assertThat(markRepository.existsById(markId)).isFalse();
        assertThat(collectionItemRepository.findByBookId(bookId)).isEmpty();
        assertThat(file).doesNotExist();
    }

    @Test
    void deletingMissingBookReturns404() throws Exception {
        mockMvc.perform(delete("/api/books/987654321")).andExpect(status().isNotFound());
    }

    // Characterisation: must hold both before and after the self-referencing
    // ON DELETE CASCADE on book_collections.parent_id (DB-02).
    @Test
    void deletingCollectionRemovesItsWholeSubtreeAndMemberships() throws Exception {
        long bookId = postForId("/api/books", Map.of("title", "Shelved book"));
        long root = postForId("/api/book-collections", Map.of("name", "Root"));
        long child = postForId("/api/book-collections", Map.of("name", "Child", "parentId", root));
        long grandchild = postForId("/api/book-collections", Map.of("name", "Grandchild", "parentId", child));
        long sibling = postForId("/api/book-collections", Map.of("name", "Sibling"));
        for (long folder : new long[]{root, child, grandchild, sibling}) {
            mockMvc.perform(post("/api/book-collections/" + folder + "/books/" + bookId))
                    .andExpect(status().is2xxSuccessful());
        }

        mockMvc.perform(delete("/api/book-collections/" + root)).andExpect(status().isNoContent());

        assertThat(collectionRepository.findAllById(List.of(root, child, grandchild))).isEmpty();
        assertThat(collectionRepository.existsById(sibling)).isTrue();
        assertThat(collectionItemRepository.findByBookId(bookId))
                .extracting(item -> item.getCollectionId()).containsExactly(sibling);
        mockMvc.perform(get("/api/books/" + bookId)).andExpect(status().isOk());
    }

    private JsonNode uploadImage(long chapterId) throws Exception {
        String body = mockMvc.perform(multipart("/api/chapters/" + chapterId + "/images")
                        .file(new MockMultipartFile("files", "pic.png", "image/png", PNG)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode images = objectMapper.readTree(body).get("images");
        assertThat(images).hasSize(1);
        return images.get(0);
    }

    private Path imageFile(JsonNode image) {
        Path file = storage.resolve(image.get("filename").asString()).orElseThrow();
        assertThat(file).exists();
        return file;
    }
}
