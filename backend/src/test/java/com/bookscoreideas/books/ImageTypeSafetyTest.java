package com.bookscoreideas.books;

import com.bookscoreideas.entity.ChapterImage;
import com.bookscoreideas.repository.ChapterImageRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.service.ChapterImageStorage;
import com.bookscoreideas.support.IntegrationTest;
import tools.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * SEC-02: image uploads are served from the app's own origin, so a file that a browser would
 * run as a page (SVG with a script, HTML) must never be stored or served as an image. The type
 * comes from the file's bytes, never from the client's Content-Type or file name.
 */
class ImageTypeSafetyTest extends IntegrationTest {

    private static final byte[] PNG = HexFormat.of().parseHex("89504e470d0a1a0a0000000d49484452");
    private static final byte[] JPEG = HexFormat.of().parseHex("ffd8ffe000104a464946000101");
    private static final byte[] GIF = "GIF89a\u0001\u0000\u0001\u0000".getBytes(StandardCharsets.ISO_8859_1);
    private static final byte[] WEBP = "RIFF\u0024\u0000\u0000\u0000WEBPVP8 ".getBytes(StandardCharsets.ISO_8859_1);
    private static final byte[] SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"
            .getBytes(StandardCharsets.UTF_8);
    private static final byte[] HTML = "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8);

    @Autowired private ChapterImageStorage storage;
    @Autowired private ChapterImageRepository imageRepository;
    @Autowired private ChapterRepository chapterRepository;

    @ParameterizedTest
    @CsvSource({
            "PNG,  shot.png,  image/png,                image/png,  .png",
            "JPEG, photo.JPG, image/jpeg,               image/jpeg, .jpg",
            "GIF,  anim.gif,  image/gif,                image/gif,  .gif",
            "WEBP, pic.webp,  image/webp,               image/webp, .webp",
            // the bytes decide, not the client's claims
            "PNG,  scan,      application/octet-stream, image/png,  .png",
            "JPEG, photo.png, image/png,                image/jpeg, .jpg"})
    void storesSupportedImagesByTheirActualType(String kind, String name, String declared,
                                                String expectedType, String expectedExtension) throws Exception {
        String base = imagesOf(newChapter());

        JsonNode saved = upload(base, new MockMultipartFile("files", name, declared, bytes(kind)));

        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).get("contentType").asString()).isEqualTo(expectedType);
        assertThat(saved.get(0).get("filename").asString()).endsWith(expectedExtension);
        assertThat(saved.get(0).get("originalName").asString()).isEqualTo(name);
        MockHttpServletResponse data = download(base, saved.get(0).get("id").asLong());
        assertThat(data.getContentType()).isEqualTo(expectedType);
        assertThat(data.getContentAsByteArray()).isEqualTo(bytes(kind));
    }

    @ParameterizedTest
    @CsvSource({
            "SVG,  logo.svg,  image/svg+xml",
            "HTML, page.png,  image/png",
            "HTML, page.html, text/html"})
    void skipsFilesThatAreNotSupportedImages(String kind, String name, String declared) throws Exception {
        String base = imagesOf(newChapter());

        JsonNode saved = upload(base, new MockMultipartFile("files", name, declared, bytes(kind)));

        assertThat(saved).isEmpty();
        assertThat(getJson(base)).isEmpty();
    }

    @Test
    void imageResponsesForbidSniffingAndScripts() throws Exception {
        String base = imagesOf(newChapter());
        long id = upload(base, new MockMultipartFile("files", "a.png", "image/png", PNG)).get(0).get("id").asLong();

        MockHttpServletResponse data = download(base, id);

        assertThat(data.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(data.getHeader("Content-Security-Policy")).contains("sandbox").contains("default-src 'none'");
        assertThat(data.getHeader(HttpHeaders.CONTENT_DISPOSITION)).isEqualTo("inline; filename=\"a.png\"");
    }

    /** Rows stored before SEC-02 (or imported from an archive) are served by what the file really is. */
    @Test
    void anOlderRowClaimingAnImageIsServedByItsActualBytes() throws Exception {
        long chapter = newChapter();
        long svg = storeDirectly(chapter, "evil.svg", "image/svg+xml", SVG);
        long png = storeDirectly(chapter, "fine.png", "application/octet-stream", PNG);

        MockHttpServletResponse unsafe = download(imagesOf(chapter), svg);
        assertThat(unsafe.getContentType()).isEqualTo("application/octet-stream");
        assertThat(ContentDisposition.parse(unsafe.getHeader(HttpHeaders.CONTENT_DISPOSITION)).isAttachment()).isTrue();
        assertThat(unsafe.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");

        MockHttpServletResponse fine = download(imagesOf(chapter), png);
        assertThat(fine.getContentType()).isEqualTo("image/png");
        assertThat(ContentDisposition.parse(fine.getHeader(HttpHeaders.CONTENT_DISPOSITION)).isInline()).isTrue();
    }

    static Stream<Arguments> awkwardNames() {
        return Stream.of(
                Arguments.of("封面 \"1\".png", "封面 \"1\".png"),
                Arguments.of("a\\\"b;c=d.png", "a\\\"b;c=d.png"),
                Arguments.of("line\r\nX-Evil: 1.png", "lineX-Evil: 1.png"));
    }

    @ParameterizedTest
    @MethodSource("awkwardNames")
    void theFileNameHeaderSurvivesQuotesNonAsciiAndLineBreaks(String name, String expected) throws Exception {
        long chapter = newChapter();
        long id = storeDirectly(chapter, name, "image/png", PNG);

        String header = download(imagesOf(chapter), id).getHeader(HttpHeaders.CONTENT_DISPOSITION);

        assertThat(header).doesNotContain("\r").doesNotContain("\n");
        assertThat(ContentDisposition.parse(header).getFilename()).isEqualTo(expected);
        // Clients that ignore filename* (RFC 5987) read the fallback filename= instead, as a
        // strict quoted-string (RFC 7230). Spring before 6.2 left quotes in it unescaped, which
        // ends the string early there; Spring's own lenient parse() did not notice (BE-10).
        // Since Spring 7 the fallback is plain ASCII with "_" for other characters (RFC 6266).
        Matcher fallback = Pattern.compile("filename=\"((?:[^\"\\\\]|\\\\.)*)\"\\s*(?:;|$)").matcher(header);
        assertThat(fallback.find()).as("strict quoted-string filename= in %s", header).isTrue();
        assertThat(ContentDisposition.parse("inline; filename=\"" + fallback.group(1) + "\"").getFilename())
                .isEqualTo(expected.replaceAll("[^\\x00-\\x7F]", "_"));
    }

    private long storeDirectly(long chapterId, String originalName, String contentType, byte[] bytes) throws Exception {
        String filename = UUID.randomUUID() + ".bin";
        storage.store(filename, new ByteArrayInputStream(bytes));
        ChapterImage image = new ChapterImage();
        image.setFilename(filename);
        image.setOriginalName(originalName);
        image.setContentType(contentType);
        image.setOrderIndex(1);
        image.setChapter(chapterRepository.findById(chapterId).orElseThrow());
        return imageRepository.save(image).getId();
    }

    private static byte[] bytes(String kind) {
        return switch (kind) {
            case "PNG" -> PNG;
            case "JPEG" -> JPEG;
            case "GIF" -> GIF;
            case "WEBP" -> WEBP;
            case "SVG" -> SVG;
            case "HTML" -> HTML;
            default -> throw new IllegalArgumentException(kind);
        };
    }

    private long newChapter() throws Exception {
        long book = postForId("/api/books", Map.of("title", "Image types"));
        return postForId("/api/books/" + book + "/chapters", Map.of("title", "Ch"));
    }

    private static String imagesOf(long chapter) {
        return "/api/chapters/" + chapter + "/images";
    }

    /** The saved images of the upload report (BUG-10). */
    private JsonNode upload(String url, MockMultipartFile file) throws Exception {
        return objectMapper.readTree(mockMvc.perform(multipart(url).file(file))
                .andExpect(status().is2xxSuccessful()).andReturn().getResponse().getContentAsString()).get("images");
    }

    private MockHttpServletResponse download(String base, long id) throws Exception {
        return mockMvc.perform(get(base + "/" + id + "/data")).andExpect(status().isOk()).andReturn().getResponse();
    }

    private JsonNode getJson(String url) throws Exception {
        return objectMapper.readTree(mockMvc.perform(get(url)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
}
