package com.bookscoreideas.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Optional;

/**
 * The status-code contract of doc/api-conventions.md in one place: reads/updates 200,
 * creates 201, deletes 204, and "not found" thrown as {@link NotFoundException} so it
 * becomes a 404 ProblemDetail like every other error (not an empty 404 body).
 */
public final class Responses {

    private Responses() {
    }

    /** 200 with the body, or 404 naming {@code resource id}. */
    public static <T> ResponseEntity<T> ok(Optional<T> body, String resource, Object id) {
        return ResponseEntity.ok(body.orElseThrow(() -> NotFoundException.of(resource, id)));
    }

    /** 201 with the created resource. */
    public static <T> ResponseEntity<T> created(T body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    /** 201, or 404 naming the missing parent the resource was to be created under. */
    public static <T> ResponseEntity<T> created(Optional<T> body, String parent, Object parentId) {
        return created(body.orElseThrow(() -> NotFoundException.of(parent, parentId)));
    }

    /** 204, or 404 naming {@code resource id}. */
    public static ResponseEntity<Void> deleted(boolean found, String resource, Object id) {
        if (!found) throw NotFoundException.of(resource, id);
        return ResponseEntity.noContent().build();
    }
}
