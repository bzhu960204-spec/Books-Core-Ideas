package com.bookscoreideas.controller;

import com.bookscoreideas.dto.FavoriteDto;
import com.bookscoreideas.dto.FavoriteRequest;
import com.bookscoreideas.service.FavoriteService;
import com.bookscoreideas.web.Responses;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ChapterFavoriteController {

    private final FavoriteService favoriteService;

    public ChapterFavoriteController(FavoriteService favoriteService) {
        this.favoriteService = favoriteService;
    }

    /** Upsert, like the explanation's PUT: 200 whether or not the chapter was already a favorite. */
    @PutMapping("/chapters/{chapterId}/favorite")
    public ResponseEntity<FavoriteDto> favorite(@PathVariable Long chapterId,
                                                @Valid @RequestBody(required = false) FavoriteRequest body) {
        String note = body != null ? body.note() : null;
        return Responses.ok(favoriteService.favorite(chapterId, note), "Chapter", chapterId);
    }

    @DeleteMapping("/chapters/{chapterId}/favorite")
    public ResponseEntity<Void> unfavorite(@PathVariable Long chapterId) {
        return Responses.deleted(favoriteService.unfavorite(chapterId), "Chapter", chapterId);
    }

    @GetMapping("/favorites")
    public List<FavoriteDto> list(@RequestParam(required = false) Long bookId,
                                  @RequestParam(required = false) String q) {
        return favoriteService.list(bookId, q);
    }
}
