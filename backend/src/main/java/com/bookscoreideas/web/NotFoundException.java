package com.bookscoreideas.web;

/** A requested resource does not exist; mapped to HTTP 404 by {@link GlobalExceptionHandler}. */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }

    public static NotFoundException of(String resource, Object id) {
        return new NotFoundException(resource + " not found: " + id);
    }
}
