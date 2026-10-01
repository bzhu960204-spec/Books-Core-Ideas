package com.bookscoreideas.service;

import com.bookscoreideas.dto.migration.BookArchiveDto;
import com.bookscoreideas.dto.migration.ChapterArchiveDto;
import com.bookscoreideas.dto.migration.ExcerptArchiveDto;
import com.bookscoreideas.dto.migration.ExplanationArchiveDto;
import com.bookscoreideas.dto.migration.ImageArchiveDto;
import com.bookscoreideas.dto.migration.ImportBookResultDto;
import com.bookscoreideas.dto.migration.ImportPreviewDto;
import com.bookscoreideas.dto.migration.ImportPreviewEntryDto;
import com.bookscoreideas.dto.migration.ImportResultDto;
import com.bookscoreideas.dto.migration.KeyIdeaArchiveDto;
import com.bookscoreideas.dto.migration.ManifestDto;
import com.bookscoreideas.dto.migration.ManifestEntryDto;
import com.bookscoreideas.dto.migration.PartArchiveDto;
import com.bookscoreideas.entity.Book;
import com.bookscoreideas.entity.Chapter;
import com.bookscoreideas.entity.ChapterExplanation;
import com.bookscoreideas.entity.ChapterImage;
import com.bookscoreideas.entity.Excerpt;
import com.bookscoreideas.entity.KeyIdea;
import com.bookscoreideas.entity.Part;
import com.bookscoreideas.repository.BookRepository;
import com.bookscoreideas.repository.ChapterExplanationRepository;
import com.bookscoreideas.repository.ChapterImageRepository;
import com.bookscoreideas.repository.ChapterRepository;
import com.bookscoreideas.repository.ExcerptRepository;
import com.bookscoreideas.repository.KeyIdeaRepository;
import com.bookscoreideas.repository.PartRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

@Service
public class MigrationService {

    public static final int FORMAT_VERSION = 1;

    // Guards against zip bombs during import.
    private static final long MAX_TOTAL_UNCOMPRESSED = 500L * 1024 * 1024; // 500 MB
    private static final int MAX_ENTRIES = 50_000;

    private final BookRepository bookRepository;
    private final PartRepository partRepository;
    private final ChapterRepository chapterRepository;
    private final KeyIdeaRepository keyIdeaRepository;
    private final ExcerptRepository excerptRepository;
    private final ChapterExplanationRepository explanationRepository;
    private final ChapterImageRepository imageRepository;
    private final MigrationImporter importer;
    private final ObjectMapper objectMapper;
    private final Path uploadDir;

    public MigrationService(BookRepository bookRepository, PartRepository partRepository,
                            ChapterRepository chapterRepository, KeyIdeaRepository keyIdeaRepository,
                            ExcerptRepository excerptRepository,
                            ChapterExplanationRepository explanationRepository,
                            ChapterImageRepository imageRepository, MigrationImporter importer,
                            ObjectMapper objectMapper,
                            @Value("${app.upload.dir:./data/images}") String uploadPath) {
        this.bookRepository = bookRepository;
        this.partRepository = partRepository;
        this.chapterRepository = chapterRepository;
        this.keyIdeaRepository = keyIdeaRepository;
        this.excerptRepository = excerptRepository;
        this.explanationRepository = explanationRepository;
        this.imageRepository = imageRepository;
        this.importer = importer;
        this.objectMapper = objectMapper;
        this.uploadDir = Paths.get(uploadPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            throw new RuntimeException("Could not create upload directory", e);
        }
    }

    // ---------------------------------------------------------------- EXPORT

    public void exportBooks(List<Long> bookIds, OutputStream os) throws IOException {
        List<Book> books = (bookIds == null || bookIds.isEmpty())
                ? bookRepository.findAll()
                : bookRepository.findAllById(bookIds);

        try (ZipOutputStream zip = new ZipOutputStream(os)) {
            List<ManifestEntryDto> entries = new ArrayList<>();
            Set<String> usedSlugs = new HashSet<>();

            for (Book book : books) {
                String slug = uniqueSlug(book, usedSlugs);
                BookArchiveDto dto = buildBookDto(book);

                String jsonPath = "books/" + slug + "/book.json";
                zip.putNextEntry(new ZipEntry(jsonPath));
                zip.write(objectMapper.writeValueAsBytes(dto));
                zip.closeEntry();

                int imageCount = 0;
                for (ChapterArchiveDto chapter : allChapters(dto)) {
                    if (chapter.images() == null) continue;
                    for (ImageArchiveDto img : chapter.images()) {
                        if (img.filename() == null) continue;
                        Path src = uploadDir.resolve(img.filename()).normalize();
                        if (!src.startsWith(uploadDir) || !Files.exists(src)) continue;
                        zip.putNextEntry(new ZipEntry("books/" + slug + "/images/" + img.filename()));
                        Files.copy(src, zip);
                        zip.closeEntry();
                        imageCount++;
                    }
                }

                entries.add(new ManifestEntryDto(slug, book.getTitle(), book.getAuthor(),
                        jsonPath, countChapters(dto), imageCount));
            }

            ManifestDto manifest = new ManifestDto(FORMAT_VERSION, LocalDateTime.now().toString(), entries);
            zip.putNextEntry(new ZipEntry("manifest.json"));
            zip.write(objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(manifest));
            zip.closeEntry();
        }
    }

    private BookArchiveDto buildBookDto(Book book) {
        boolean isParts = "PARTS".equals(book.getStructureType());
        List<PartArchiveDto> parts = null;
        List<ChapterArchiveDto> chapters = null;

        if (isParts) {
            parts = new ArrayList<>();
            for (Part part : partRepository.findByBookIdOrderByOrderIndexAsc(book.getId())) {
                List<ChapterArchiveDto> partChapters = new ArrayList<>();
                for (Chapter chapter : chapterRepository.findByPart_IdOrderByOrderIndexAsc(part.getId())) {
                    partChapters.add(buildChapterDto(chapter));
                }
                parts.add(new PartArchiveDto(part.getTitle(), part.getOrderIndex(), part.getSummary(), partChapters));
            }
        } else {
            chapters = new ArrayList<>();
            for (Chapter chapter : chapterRepository.findByBookIdOrderByOrderIndexAsc(book.getId())) {
                chapters.add(buildChapterDto(chapter));
            }
        }

        return new BookArchiveDto(
                FORMAT_VERSION,
                book.getTitle(), book.getAuthor(), book.getIsbn(), book.getDescription(),
                book.getCoverUrl(), book.getRating(), book.getCategory(), book.getReadingStatus(),
                toStringOrNull(book.getDateAdded()), toStringOrNull(book.getStartDate()),
                toStringOrNull(book.getFinishDate()), book.getChapterImagesEnabled(),
                isParts ? "PARTS" : "CHAPTERS", parts, chapters);
    }

    private ChapterArchiveDto buildChapterDto(Chapter chapter) {
        List<KeyIdeaArchiveDto> ideas = new ArrayList<>();
        for (KeyIdea idea : keyIdeaRepository.findByChapterIdOrderByOrderIndexAsc(chapter.getId())) {
            ideas.add(new KeyIdeaArchiveDto(idea.getContent(), idea.getExample(), idea.getTags(),
                    idea.isHighlighted(), idea.getOrderIndex()));
        }

        List<ExcerptArchiveDto> excerpts = new ArrayList<>();
        for (Excerpt excerpt : excerptRepository.findByChapterIdOrderByOrderIndexAsc(chapter.getId())) {
            excerpts.add(new ExcerptArchiveDto(excerpt.getContent(), excerpt.getNote(), excerpt.getSource(),
                    excerpt.isHighlighted(), excerpt.getOrderIndex()));
        }

        ExplanationArchiveDto explanation = explanationRepository.findByChapterId(chapter.getId())
                .map(e -> new ExplanationArchiveDto(e.getContent(), toStringOrNull(e.getUpdatedAt())))
                .orElse(null);

        List<ImageArchiveDto> images = new ArrayList<>();
        for (ChapterImage img : imageRepository.findByChapterIdOrderByOrderIndexAsc(chapter.getId())) {
            images.add(new ImageArchiveDto(img.getFilename(), img.getOriginalName(),
                    img.getContentType(), img.getOrderIndex()));
        }

        return new ChapterArchiveDto(chapter.getTitle(), chapter.getOrderIndex(), chapter.getSummary(),
                explanation, ideas, excerpts, images);
    }

    // ---------------------------------------------------------------- IMPORT

    public ImportResultDto importArchive(InputStream zipStream) throws IOException {
        Map<String, byte[]> files = readZip(zipStream);
        ManifestDto manifest = readManifest(files);

        Set<String> existingKeys = loadExistingBookKeys();
        List<ImportBookResultDto> details = new ArrayList<>();
        int imported = 0, skipped = 0, failed = 0;

        for (ManifestEntryDto entry : manifest.books()) {
            BookArchiveDto dto;
            try {
                dto = objectMapper.readValue(requireFile(files, entry.path()), BookArchiveDto.class);
            } catch (Exception e) {
                failed++;
                details.add(new ImportBookResultDto(entry.title(), entry.author(), "FAILED",
                        "Could not read book data: " + e.getMessage(), 0, 0));
                continue;
            }

            String key = bookKey(dto.title(), dto.author());
            if (existingKeys.contains(key)) {
                skipped++;
                details.add(new ImportBookResultDto(dto.title(), dto.author(), "SKIPPED_CONFLICT",
                        "A book with the same title and author already exists.", 0, 0));
                continue;
            }

            try {
                Map<String, byte[]> images = collectImages(files, entry.path());
                MigrationImporter.PersistOutcome outcome = importer.persistBook(dto, images);
                writeImages(outcome.imageWrites());
                existingKeys.add(key);
                imported++;
                details.add(new ImportBookResultDto(dto.title(), dto.author(), "IMPORTED", null,
                        outcome.chaptersImported(), outcome.imageWrites().size()));
            } catch (Exception e) {
                failed++;
                details.add(new ImportBookResultDto(dto.title(), dto.author(), "FAILED",
                        "Import failed: " + e.getMessage(), 0, 0));
            }
        }

        return new ImportResultDto(imported, skipped, failed, details);
    }

    public ImportPreviewDto previewArchive(InputStream zipStream) throws IOException {
        Map<String, byte[]> files = readZip(zipStream);
        ManifestDto manifest = readManifest(files);

        Set<String> existingKeys = loadExistingBookKeys();
        Set<String> seen = new HashSet<>();
        List<ImportPreviewEntryDto> entries = new ArrayList<>();
        int conflicts = 0;

        for (ManifestEntryDto entry : manifest.books()) {
            BookArchiveDto dto;
            try {
                dto = objectMapper.readValue(requireFile(files, entry.path()), BookArchiveDto.class);
            } catch (Exception e) {
                continue;
            }
            String key = bookKey(dto.title(), dto.author());
            boolean conflict = existingKeys.contains(key) || seen.contains(key);
            seen.add(key);
            if (conflict) conflicts++;

            List<ChapterArchiveDto> chapters = allChapters(dto);
            boolean hasExplanations = chapters.stream()
                    .anyMatch(c -> c.explanation() != null && c.explanation().content() != null
                            && !c.explanation().content().isBlank());

            entries.add(new ImportPreviewEntryDto(dto.title(), dto.author(), chapters.size(),
                    entry.imageCount(), hasExplanations, conflict));
        }

        return new ImportPreviewDto(manifest.formatVersion(), entries.size(), conflicts, entries);
    }

    // ---------------------------------------------------------------- HELPERS

    private Set<String> loadExistingBookKeys() {
        Set<String> keys = new HashSet<>();
        for (Book book : bookRepository.findAll()) {
            keys.add(bookKey(book.getTitle(), book.getAuthor()));
        }
        return keys;
    }

    private static String bookKey(String title, String author) {
        return norm(title) + "\u0000" + norm(author);
    }

    private static String norm(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    private ManifestDto readManifest(Map<String, byte[]> files) throws IOException {
        byte[] bytes = files.get("manifest.json");
        if (bytes == null) {
            throw new IllegalArgumentException("Not a valid migration archive: manifest.json is missing.");
        }
        ManifestDto manifest = objectMapper.readValue(bytes, ManifestDto.class);
        if (manifest.books() == null) {
            throw new IllegalArgumentException("Migration archive manifest has no books.");
        }
        return manifest;
    }

    private static byte[] requireFile(Map<String, byte[]> files, String path) {
        byte[] bytes = files.get(path);
        if (bytes == null) {
            throw new IllegalArgumentException("Archive is missing entry: " + path);
        }
        return bytes;
    }

    private Map<String, byte[]> collectImages(Map<String, byte[]> files, String bookJsonPath) {
        int slash = bookJsonPath.lastIndexOf('/');
        String prefix = (slash >= 0 ? bookJsonPath.substring(0, slash + 1) : "") + "images/";
        Map<String, byte[]> images = new HashMap<>();
        for (Map.Entry<String, byte[]> file : files.entrySet()) {
            if (file.getKey().startsWith(prefix)) {
                images.put(file.getKey().substring(prefix.length()), file.getValue());
            }
        }
        return images;
    }

    private void writeImages(List<MigrationImporter.PendingImageWrite> writes) throws IOException {
        for (MigrationImporter.PendingImageWrite write : writes) {
            Path target = uploadDir.resolve(write.filename()).normalize();
            if (!target.startsWith(uploadDir)) continue;
            Files.write(target, write.bytes());
        }
    }

    private Map<String, byte[]> readZip(InputStream in) throws IOException {
        Map<String, byte[]> files = new LinkedHashMap<>();
        long total = 0;
        int count = 0;
        try (ZipInputStream zis = new ZipInputStream(in)) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.isDirectory()) continue;
                if (++count > MAX_ENTRIES) {
                    throw new IllegalArgumentException("Archive has too many entries.");
                }
                String name = entry.getName().replace('\\', '/');
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                int n;
                while ((n = zis.read(buffer)) >= 0) {
                    total += n;
                    if (total > MAX_TOTAL_UNCOMPRESSED) {
                        throw new IllegalArgumentException("Archive is too large to import.");
                    }
                    bos.write(buffer, 0, n);
                }
                files.put(name, bos.toByteArray());
            }
        }
        return files;
    }

    private List<ChapterArchiveDto> allChapters(BookArchiveDto dto) {
        List<ChapterArchiveDto> chapters = new ArrayList<>();
        if (dto.chapters() != null) chapters.addAll(dto.chapters());
        if (dto.parts() != null) {
            for (PartArchiveDto part : dto.parts()) {
                if (part.chapters() != null) chapters.addAll(part.chapters());
            }
        }
        return chapters;
    }

    private int countChapters(BookArchiveDto dto) {
        return allChapters(dto).size();
    }

    private String uniqueSlug(Book book, Set<String> used) {
        String base = slugify(book.getTitle());
        String slug = base;
        int i = 2;
        while (used.contains(slug)) {
            slug = base + "-" + i++;
        }
        used.add(slug);
        return slug;
    }

    private static String slugify(String title) {
        if (title == null) return "book";
        String slug = title.trim().toLowerCase()
                .replaceAll("[^a-z0-9\\u4e00-\\u9fff]+", "-")
                .replaceAll("^-+|-+$", "");
        return slug.isEmpty() ? "book" : slug;
    }

    private static String toStringOrNull(Object value) {
        return value != null ? value.toString() : null;
    }
}
