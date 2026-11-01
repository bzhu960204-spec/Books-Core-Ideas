package com.bookscoreideas.books;

import com.bookscoreideas.repository.ChapterImageRepository;
import com.bookscoreideas.service.ChapterImageStorage;
import com.bookscoreideas.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * BUG-10: an upload numbers the images it saves without gaps or duplicates, says which
 * files it skipped and why, and leaves no stray files behind when something fails.
 */
@ExtendWith(OutputCaptureExtension.class)
class ImageUploadReportTest extends IntegrationTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};

    @MockitoSpyBean private ChapterImageStorage storage;
    @MockitoSpyBean private ChapterImageRepository imageRepository;

    @Test
    void savedImagesAreNumberedWithoutGapsAndSkippedFilesAreReported() throws Exception {
        String base = imagesOf(newChapter());

        MockHttpServletResponse response = upload(base,
                png("a.png"),
                new MockMultipartFile("files", "notes.txt", "text/plain", "x".getBytes()),
                new MockMultipartFile("files", "empty.png", "image/png", new byte[0]),
                png("b.png"));

        assertThat(response.getStatus()).isEqualTo(201);
        JsonNode report = json(response);
        assertThat(names(report.get("images"))).containsExactly("a.png", "b.png");
        assertThat(orderIndexes(report.get("images"))).containsExactly(1, 2);
        assertThat(report.get("skipped")).hasSize(2);
        assertThat(report.get("skipped").get(0).get("name").asText()).isEqualTo("notes.txt");
        assertThat(report.get("skipped").get(0).get("reason").asText()).isEqualTo("not a PNG, JPEG, GIF or WebP image");
        assertThat(report.get("skipped").get(1).get("name").asText()).isEqualTo("empty.png");
        assertThat(report.get("skipped").get(1).get("reason").asText()).isEqualTo("empty file");
        assertThat(orderIndexes(getJson(base))).containsExactly(1, 2);
    }

    @Test
    void aNewUploadContinuesAfterTheLastImageEvenAfterADeletion() throws Exception {
        String base = imagesOf(newChapter());
        JsonNode first = json(upload(base, png("1.png"), png("2.png"), png("3.png"))).get("images");
        mockMvc.perform(delete(base + "/" + first.get(1).get("id").asLong())).andExpect(status().isNoContent());

        JsonNode added = json(upload(base, png("4.png"))).get("images");

        assertThat(orderIndexes(added)).containsExactly(4);
        assertThat(names(getJson(base))).containsExactly("1.png", "3.png", "4.png");
        assertThat(orderIndexes(getJson(base))).containsExactly(1, 3, 4);
    }

    @Test
    void whenNothingIsSavedTheReportComesBackWith200() throws Exception {
        String base = imagesOf(newChapter());

        MockHttpServletResponse response = upload(base, new MockMultipartFile("files", "logo.svg", "image/svg+xml", "<svg/>".getBytes()));

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(json(response).get("images")).isEmpty();
        assertThat(json(response).get("skipped").get(0).get("name").asText()).isEqualTo("logo.svg");
        assertThat(getJson(base)).isEmpty();
    }

    @Test
    void aFileThatCannotBeWrittenIsLoggedReportedAndRemoved(CapturedOutput output) throws Exception {
        String base = imagesOf(newChapter());
        doAnswer(invocation -> {
            invocation.callRealMethod(); // half-written: the file exists when the error comes
            throw new IOException("disk full");
        }).doCallRealMethod().when(storage).store(anyString(), any());
        Set<Path> before = filesInUploadDir();

        JsonNode report = json(upload(base, png("a.png"), png("b.png")));

        assertThat(names(report.get("images"))).containsExactly("b.png");
        assertThat(orderIndexes(report.get("images"))).containsExactly(1);
        assertThat(report.get("skipped").get(0).get("name").asText()).isEqualTo("a.png");
        assertThat(report.get("skipped").get(0).get("reason").asText()).isEqualTo("could not be saved");
        assertThat(output.getOut()).contains("a.png").contains("disk full");
        assertThat(newFiles(before)).containsExactly(storage.resolve(report.get("images").get(0).get("filename").asText()).orElseThrow());
    }

    @Test
    void filesOfAnUploadThatFailsAltogetherAreRemoved() throws Exception {
        long chapter = newChapter();
        doAnswer(invocation -> invocation.callRealMethod())
                .doThrow(new IllegalStateException("database gone"))
                .when(imageRepository).save(any());
        Set<Path> before = filesInUploadDir();

        MockHttpServletResponse response = upload(imagesOf(chapter), png("a.png"), png("b.png"));

        assertThat(response.getStatus()).isEqualTo(500);
        assertThat(getJson(imagesOf(chapter))).isEmpty();
        assertThat(newFiles(before)).isEmpty();
    }

    @Test
    void aVeryLongFileNameIsShortenedToFit() throws Exception {
        String name = "x".repeat(300) + ".png";

        MockHttpServletResponse response = upload(imagesOf(newChapter()), png(name));

        assertThat(response.getStatus()).isEqualTo(201);
        assertThat(json(response).get("images").get(0).get("originalName").asText()).isEqualTo(name.substring(0, 255));
    }

    private static MockMultipartFile png(String name) {
        return new MockMultipartFile("files", name, "image/png", PNG);
    }

    private Set<Path> filesInUploadDir() throws IOException {
        try (Stream<Path> files = Files.list(storage.resolve("probe").orElseThrow().getParent())) {
            return new HashSet<>(files.toList());
        }
    }

    private List<Path> newFiles(Set<Path> before) throws IOException {
        List<Path> now = new ArrayList<>(filesInUploadDir());
        now.removeAll(before);
        return now;
    }

    private long newChapter() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Uploads"));
        return postForId("/api/books/" + book + "/chapters", Map.of("title", "Ch"));
    }

    private static String imagesOf(long chapter) {
        return "/api/chapters/" + chapter + "/images";
    }

    private MockHttpServletResponse upload(String url, MockMultipartFile... files) throws Exception {
        var request = multipart(url);
        for (MockMultipartFile f : files) request.file(f);
        return mockMvc.perform(request).andReturn().getResponse();
    }

    private JsonNode json(MockHttpServletResponse response) throws Exception {
        return objectMapper.readTree(response.getContentAsString());
    }

    private static List<String> names(JsonNode images) {
        List<String> names = new ArrayList<>();
        images.forEach(image -> names.add(image.get("originalName").asText()));
        return names;
    }

    private static List<Integer> orderIndexes(JsonNode images) {
        List<Integer> indexes = new ArrayList<>();
        images.forEach(image -> indexes.add(image.get("orderIndex").asInt()));
        return indexes;
    }

    private JsonNode getJson(String url) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(url)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
}
