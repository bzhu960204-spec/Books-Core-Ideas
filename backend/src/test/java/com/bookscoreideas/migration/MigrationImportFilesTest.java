package com.bookscoreideas.migration;

import com.bookscoreideas.service.ChapterImageStorage;
import com.bookscoreideas.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * BE-07: the import reads the archive from a temporary file entry by entry and streams images
 * to disk inside each book's transaction. A book is either imported with its files or not at
 * all, and the zip bomb limits still hold although the archive is no longer read up front.
 */
class MigrationImportFilesTest extends IntegrationTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};

    @MockitoSpyBean private ChapterImageStorage storage;

    // Handed over from SEC-04: files used to be written after the commit, so a failed write
    // reported the book as FAILED while the book stayed in the database.
    @Test
    void aBookWhoseImageCannotBeWrittenIsNotImportedAndLeavesNoFiles() throws Exception {
        String broken = "Disk full " + System.nanoTime();
        String next = "After it " + System.nanoTime();
        doAnswer(invocation -> invocation.callRealMethod())
                .doAnswer(invocation -> {
                    invocation.callRealMethod(); // half-written: the file exists when the error comes
                    throw new IOException("disk full");
                })
                .doCallRealMethod()
                .when(storage).store(anyString(), any());
        Set<Path> before = filesInUploadDir();

        JsonNode details = importArchive(archive(book(broken, "a.png", "b.png"), book(next, "c.png"))).get("details");

        assertThat(details.get(0).get("status").asText()).isEqualTo("FAILED");
        assertThat(bookTitles()).doesNotContain(broken);
        assertThat(newFiles(before)).containsExactly(storedFileOf(next));
        assertThat(details.get(0).get("message").asText()).contains("b.png").contains("disk full");
        assertThat(details.get(1).get("status").asText()).isEqualTo("IMPORTED");
        assertThat(details.get(1).get("imagesImported").asInt()).isEqualTo(1);
    }

    @Test
    void filesOfABookThatRollsBackAreRemoved() throws Exception {
        String title = "Rolled back " + System.nanoTime();
        Set<Path> before = filesInUploadDir();

        // Collections are written after the chapters: the images are already stored when this fails.
        JsonNode detail = importArchive(archive(new ArchivedBook(title, List.of("a.png", "b.png"), true)))
                .get("details").get(0);

        assertThat(detail.get("status").asText()).isEqualTo("FAILED");
        assertThat(detail.get("message").asText()).contains("collection path is empty");
        assertThat(bookTitles()).doesNotContain(title);
        assertThat(newFiles(before)).isEmpty();
    }

    // Entries are read on demand, trusting the sizes in the central directory, so an entry
    // must not inflate to more than it declares.
    @Test
    void anEntryThatInflatesBeyondItsDeclaredSizeFailsItsBook() throws Exception {
        String title = "Zip bomb " + System.nanoTime();
        byte[] big = Arrays.copyOf(PNG, 100_000);
        byte[] zip = declareSize(archive(Map.of("big.png", big), book(title, "big.png")),
                "books/b0/images/big.png", 20);
        Set<Path> before = filesInUploadDir();

        JsonNode detail = importArchive(zip).get("details").get(0);

        assertThat(detail.get("status").asText()).isEqualTo("FAILED");
        assertThat(detail.get("message").asText()).contains("big.png").contains("larger than");
        assertThat(bookTitles()).doesNotContain(title);
        assertThat(newFiles(before)).isEmpty();
    }

    @Test
    void anArchiveDeclaringMoreThanTheLimitIsRefusedBeforeAnythingIsImported() throws Exception {
        String title = "Too large " + System.nanoTime();
        byte[] zip = declareSize(archive(book(title, "a.png")), "books/b0/images/a.png", 600L * 1024 * 1024);

        for (String url : List.of("/api/migration/import/preview", "/api/migration/import")) {
            String body = mockMvc.perform(multipart(url).file(new MockMultipartFile("file", "big.zip", "application/zip", zip)))
                    .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
            assertThat(objectMapper.readTree(body).get("detail").asText()).isEqualTo("Archive is too large to import.");
        }
        assertThat(bookTitles()).doesNotContain(title);
    }

    @Test
    void theTemporaryCopyOfTheUploadIsDeleted() throws Exception {
        Set<Path> before = temporaryArchives();
        byte[] zip = archive(book("Temp " + System.nanoTime(), "a.png"));

        mockMvc.perform(multipart("/api/migration/import/preview").file(new MockMultipartFile("file", "a.zip", "application/zip", zip)))
                .andExpect(status().isOk());
        importArchive(zip);
        mockMvc.perform(multipart("/api/migration/import").file(new MockMultipartFile("file", "a.zip", "application/zip", "not a zip".getBytes())))
                .andExpect(status().isBadRequest());

        assertThat(temporaryArchives()).isEqualTo(before);
    }

    // ------------------------------------------------------------------ helpers

    private record ArchivedBook(String title, List<String> images, boolean failsAfterItsImages) {
    }

    private static ArchivedBook book(String title, String... images) {
        return new ArchivedBook(title, List.of(images), false);
    }

    private byte[] archive(ArchivedBook... books) throws Exception {
        Map<String, byte[]> files = new LinkedHashMap<>();
        for (ArchivedBook book : books) {
            for (String image : book.images()) files.put(image, PNG);
        }
        return archive(files, books);
    }

    /** Book i is under books/b{i}/; every book's images directory gets all of {@code files}. */
    private byte[] archive(Map<String, byte[]> files, ArchivedBook... books) throws Exception {
        List<Map<String, Object>> entries = new ArrayList<>();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            for (int i = 0; i < books.length; i++) {
                String dir = "books/b" + i + "/";
                List<Map<String, Object>> images = new ArrayList<>();
                for (String image : books[i].images()) {
                    images.add(Map.of("filename", image, "originalName", image, "contentType", "image/png",
                            "orderIndex", images.size() + 1));
                }
                Map<String, Object> book = new LinkedHashMap<>(Map.of("formatVersion", 2, "title", books[i].title(),
                        "author", "Someone", "chapterImagesEnabled", true, "structureType", "CHAPTERS",
                        "chapters", List.of(Map.of("title", "Ch", "orderIndex", 1, "images", images))));
                if (books[i].failsAfterItsImages()) book.put("collectionPaths", List.of(List.of()));
                put(zip, dir + "book.json", objectMapper.writeValueAsBytes(book));
                for (String image : books[i].images()) put(zip, dir + "images/" + image, files.get(image));
                entries.add(Map.of("slug", "b" + i, "title", books[i].title(), "author", "Someone",
                        "path", dir + "book.json", "chapterCount", 1, "imageCount", images.size()));
            }
            put(zip, "manifest.json", objectMapper.writeValueAsBytes(
                    Map.of("formatVersion", 2, "exportedAt", "2026-11-01T00:00:00", "books", entries)));
        }
        return out.toByteArray();
    }

    private static void put(ZipOutputStream zip, String name, byte[] bytes) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(bytes);
        zip.closeEntry();
    }

    /** Rewrites the uncompressed size that the central directory records for {@code name}. */
    private static byte[] declareSize(byte[] zip, String name, long size) {
        byte[] nameBytes = name.getBytes(StandardCharsets.UTF_8);
        for (int i = 0; i + 46 <= zip.length; i++) {
            if (zip[i] != 'P' || zip[i + 1] != 'K' || zip[i + 2] != 1 || zip[i + 3] != 2) continue;
            int nameLength = (zip[i + 28] & 0xFF) | (zip[i + 29] & 0xFF) << 8;
            if (Arrays.equals(zip, i + 46, i + 46 + nameLength, nameBytes, 0, nameBytes.length)) {
                for (int b = 0; b < 4; b++) zip[i + 24 + b] = (byte) (size >>> (8 * b));
                return zip;
            }
        }
        throw new AssertionError("no central directory entry for " + name);
    }

    private JsonNode importArchive(byte[] zip) throws Exception {
        return objectMapper.readTree(mockMvc.perform(multipart("/api/migration/import")
                        .file(new MockMultipartFile("file", "export.zip", "application/zip", zip)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private List<String> bookTitles() throws Exception {
        List<String> titles = new ArrayList<>();
        getJson("/api/books").forEach(book -> titles.add(book.get("title").asText()));
        return titles;
    }

    private Path storedFileOf(String title) throws Exception {
        for (JsonNode book : getJson("/api/books")) {
            if (!book.get("title").asText().equals(title)) continue;
            long chapter = getJson("/api/books/" + book.get("id").asLong() + "/chapters").get(0).get("id").asLong();
            String filename = getJson("/api/chapters/" + chapter + "/images").get(0).get("filename").asText();
            return storage.resolve(filename).orElseThrow();
        }
        throw new AssertionError("book not imported: " + title);
    }

    private Set<Path> filesInUploadDir() throws IOException {
        return list(storage.resolve("probe").orElseThrow().getParent(), "*");
    }

    private List<Path> newFiles(Set<Path> before) throws IOException {
        List<Path> now = new ArrayList<>(filesInUploadDir());
        now.removeAll(before);
        return now;
    }

    private static Set<Path> temporaryArchives() throws IOException {
        return list(Path.of(System.getProperty("java.io.tmpdir")), "bci-migration-*");
    }

    private static Set<Path> list(Path dir, String glob) throws IOException {
        Set<Path> files = new HashSet<>();
        try (var stream = Files.newDirectoryStream(dir, glob)) {
            stream.forEach(files::add);
        }
        return files;
    }

    private JsonNode getJson(String url) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(url)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
}
