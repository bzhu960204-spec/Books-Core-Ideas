package com.bookscoreideas.service;

import com.bookscoreideas.dto.SkippedFile;
import com.bookscoreideas.dto.migration.BookArchiveDto;
import com.bookscoreideas.dto.migration.ChapterArchiveDto;
import com.bookscoreideas.dto.migration.ImageArchiveDto;
import com.bookscoreideas.dto.migration.ImportBookResultDto;
import com.bookscoreideas.dto.migration.ImportPreviewDto;
import com.bookscoreideas.dto.migration.ImportPreviewEntryDto;
import com.bookscoreideas.dto.migration.ImportResultDto;
import com.bookscoreideas.dto.migration.ManifestDto;
import com.bookscoreideas.dto.migration.ManifestEntryDto;
import com.bookscoreideas.dto.migration.PartArchiveDto;
import com.bookscoreideas.entity.Book;
import com.bookscoreideas.repository.BookRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.Closeable;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipException;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

@Service
public class MigrationService {

    private static final Logger log = LoggerFactory.getLogger(MigrationService.class);

    /**
     * Archive format written by this version. 1: book tree, explanations, images.
     * 2 (BE-08): plus reviews, reading bookmarks, saved passages, collection paths, and
     * imports keep the original timestamps. Imports accept every version up to this one.
     */
    public static final int FORMAT_VERSION = 2;

    // Guards against zip bombs during import.
    private static final long MAX_TOTAL_UNCOMPRESSED = 500L * 1024 * 1024; // 500 MB
    private static final int MAX_ENTRIES = 50_000;

    private static final String NO_MANIFEST = "Not a valid migration archive: manifest.json is missing.";

    private final BookRepository bookRepository;
    private final BookArchiveBuilder archiveBuilder;
    private final MigrationImporter importer;
    private final ObjectMapper objectMapper;
    private final ChapterImageStorage imageStorage;

    public MigrationService(BookRepository bookRepository, BookArchiveBuilder archiveBuilder,
                            MigrationImporter importer, ObjectMapper objectMapper,
                            ChapterImageStorage imageStorage) {
        this.bookRepository = bookRepository;
        this.archiveBuilder = archiveBuilder;
        this.importer = importer;
        this.objectMapper = objectMapper;
        this.imageStorage = imageStorage;
    }

    // ---------------------------------------------------------------- EXPORT

    @Transactional(readOnly = true)
    public void exportBooks(List<Long> bookIds, OutputStream os) throws IOException {
        List<Book> books = (bookIds == null || bookIds.isEmpty())
                ? bookRepository.findAll()
                : bookRepository.findAllById(bookIds);

        try (ZipOutputStream zip = new ZipOutputStream(os)) {
            List<ManifestEntryDto> entries = new ArrayList<>();
            Set<String> usedSlugs = new HashSet<>();

            for (Book book : books) {
                String slug = uniqueSlug(book, usedSlugs);
                BookArchiveDto dto = archiveBuilder.build(book);

                String jsonPath = "books/" + slug + "/book.json";
                zip.putNextEntry(new ZipEntry(jsonPath));
                zip.write(objectMapper.writeValueAsBytes(dto));
                zip.closeEntry();

                int imageCount = 0;
                for (ChapterArchiveDto chapter : allChapters(dto)) {
                    if (chapter.images() == null) continue;
                    for (ImageArchiveDto img : chapter.images()) {
                        if (img.filename() == null) continue;
                        Optional<Path> src = imageStorage.existing(img.filename());
                        if (src.isEmpty()) continue;
                        zip.putNextEntry(new ZipEntry("books/" + slug + "/images/" + img.filename()));
                        Files.copy(src.get(), zip);
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

    // ---------------------------------------------------------------- IMPORT

    /** @param zipFile the uploaded archive, saved to a file so its entries can be read on demand (BE-07) */
    public ImportResultDto importArchive(Path zipFile) throws IOException {
        try (Archive archive = Archive.open(zipFile)) {
            ManifestDto manifest = readManifest(archive);

            Set<String> existingKeys = loadExistingBookKeys();
            List<ImportBookResultDto> details = new ArrayList<>();
            int imported = 0, skipped = 0, failed = 0;

            for (ManifestEntryDto entry : manifest.books()) {
                BookArchiveDto dto;
                try {
                    dto = readBook(archive, entry.path());
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
                    MigrationImporter.PersistOutcome outcome = importer.persistBook(dto, archive.imagesOf(entry.path()));
                    existingKeys.add(key);
                    imported++;
                    details.add(new ImportBookResultDto(dto.title(), dto.author(), "IMPORTED",
                            skippedMessage(outcome.skippedImages()),
                            outcome.chaptersImported(), outcome.imagesImported()));
                } catch (Exception e) {
                    log.warn("Could not import \"{}\" from a migration archive", dto.title(), e);
                    failed++;
                    details.add(new ImportBookResultDto(dto.title(), dto.author(), "FAILED",
                            "Import failed: " + e.getMessage(), 0, 0));
                }
            }

            return new ImportResultDto(imported, skipped, failed, details);
        }
    }

    /** @param zipFile the uploaded archive; only manifest.json and the book.json entries are read */
    public ImportPreviewDto previewArchive(Path zipFile) throws IOException {
        try (Archive archive = Archive.open(zipFile)) {
            ManifestDto manifest = readManifest(archive);

            Set<String> existingKeys = loadExistingBookKeys();
            Set<String> seen = new HashSet<>();
            List<ImportPreviewEntryDto> entries = new ArrayList<>();
            int conflicts = 0;

            for (ManifestEntryDto entry : manifest.books()) {
                BookArchiveDto dto;
                try {
                    dto = readBook(archive, entry.path());
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
                        entry.imageCount(), hasExplanations, conflict,
                        size(dto.reviews()),
                        chapters.stream().mapToInt(c -> size(c.bookmarks())).sum(),
                        chapters.stream().mapToInt(c -> size(c.marks())).sum(),
                        size(dto.collectionPaths())));
            }

            return new ImportPreviewDto(manifest.formatVersion(), entries.size(), conflicts, entries);
        }
    }

    // ---------------------------------------------------------------- HELPERS

    /** "Skipped 2 images: a.svg (reason); b.png (reason)", or null when every image was imported. */
    private static String skippedMessage(List<SkippedFile> skipped) {
        if (skipped.isEmpty()) return null;
        StringBuilder message = new StringBuilder("Skipped ").append(skipped.size())
                .append(skipped.size() == 1 ? " image: " : " images: ");
        for (int i = 0; i < skipped.size(); i++) {
            if (i > 0) message.append("; ");
            message.append(skipped.get(i).name()).append(" (").append(skipped.get(i).reason()).append(')');
        }
        return message.toString();
    }

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

    private ManifestDto readManifest(Archive archive) throws IOException {
        Optional<InputStream> in = archive.open("manifest.json");
        if (in.isEmpty()) {
            throw new IllegalArgumentException(NO_MANIFEST);
        }
        ManifestDto manifest;
        try (InputStream stream = in.get()) {
            manifest = objectMapper.readValue(stream, ManifestDto.class);
        }
        if (manifest.formatVersion() > FORMAT_VERSION) {
            // Importing it anyway would silently drop whatever the newer format added.
            throw new IllegalArgumentException("This archive uses format version " + manifest.formatVersion()
                    + "; this app reads versions up to " + FORMAT_VERSION + ". Update the app to import it.");
        }
        if (manifest.books() == null) {
            throw new IllegalArgumentException("Migration archive manifest has no books.");
        }
        return manifest;
    }

    private BookArchiveDto readBook(Archive archive, String path) throws IOException {
        try (InputStream in = archive.open(path)
                .orElseThrow(() -> new IllegalArgumentException("Archive is missing entry: " + path))) {
            return objectMapper.readValue(in, BookArchiveDto.class);
        }
    }

    /**
     * A migration archive in a file, read entry by entry (BE-07): only manifest.json and the
     * book.json being imported are held in memory, and images are streamed to disk.
     * Zip bomb guards: the entry count and the total of the sizes the entries declare are
     * checked when it is opened, and no entry may inflate to more than it declares.
     */
    private static final class Archive implements Closeable {
        private final ZipFile zip;
        private final Map<String, ZipEntry> entries;

        private Archive(ZipFile zip, Map<String, ZipEntry> entries) {
            this.zip = zip;
            this.entries = entries;
        }

        static Archive open(Path file) throws IOException {
            ZipFile zip;
            try {
                zip = new ZipFile(file.toFile());
            } catch (ZipException e) {
                // Not a ZIP file at all: the same answer as for a ZIP file without a manifest.
                throw new IllegalArgumentException(NO_MANIFEST, e);
            }
            try {
                return new Archive(zip, index(zip));
            } catch (RuntimeException e) {
                zip.close();
                throw e;
            }
        }

        private static Map<String, ZipEntry> index(ZipFile zip) {
            Map<String, ZipEntry> entries = new HashMap<>();
            long total = 0;
            int count = 0;
            for (Enumeration<? extends ZipEntry> all = zip.entries(); all.hasMoreElements(); ) {
                ZipEntry entry = all.nextElement();
                if (entry.isDirectory()) continue;
                if (++count > MAX_ENTRIES) {
                    throw new IllegalArgumentException("Archive has too many entries.");
                }
                total += Math.max(entry.getSize(), 0);
                if (total > MAX_TOTAL_UNCOMPRESSED) {
                    throw new IllegalArgumentException("Archive is too large to import.");
                }
                entries.put(entry.getName().replace('\\', '/'), entry);
            }
            return entries;
        }

        /** @return empty if the archive has no such entry */
        Optional<InputStream> open(String name) throws IOException {
            ZipEntry entry = entries.get(name);
            if (entry == null) return Optional.empty();
            long declared = entry.getSize() >= 0 ? entry.getSize() : MAX_TOTAL_UNCOMPRESSED;
            return Optional.of(new DeclaredSizeInputStream(zip.getInputStream(entry), name, declared));
        }

        /** The images of the book whose book.json is at {@code bookJsonPath}: its sibling images/ folder. */
        BookTreeWriter.ImageSource imagesOf(String bookJsonPath) {
            int slash = bookJsonPath.lastIndexOf('/');
            String prefix = (slash >= 0 ? bookJsonPath.substring(0, slash + 1) : "") + "images/";
            return filename -> open(prefix + filename);
        }

        @Override
        public void close() throws IOException {
            zip.close();
        }
    }

    /** Fails as soon as an entry yields more bytes than the archive says it has. */
    private static final class DeclaredSizeInputStream extends FilterInputStream {
        private final String name;
        private final long declared;
        private long read;

        DeclaredSizeInputStream(InputStream in, String name, long declared) {
            super(in);
            this.name = name;
            this.declared = declared;
        }

        @Override
        public int read() throws IOException {
            int b = super.read();
            if (b >= 0) count(1);
            return b;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            int n = super.read(b, off, len);
            if (n > 0) count(n);
            return n;
        }

        @Override
        public long skip(long n) throws IOException {
            long skipped = super.skip(n);
            count(skipped);
            return skipped;
        }

        private void count(long n) throws ZipException {
            read += n;
            if (read > declared) {
                throw new ZipException("Archive entry " + name + " is larger than its declared size; the archive is corrupt.");
            }
        }
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

    private static int size(List<?> list) {
        return list == null ? 0 : list.size();
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
}
