package com.bookscoreideas.dto.jsonimport;

/** What an import into an existing book created. */
public record ImportSummaryDto(int parts, int chapters, int ideas, int excerpts) {
}
