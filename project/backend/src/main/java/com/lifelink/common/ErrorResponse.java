package com.lifelink.common;

import java.time.Instant;
import java.util.Map;

public record ErrorResponse(boolean success, ErrorBody error, Instant timestamp) {
    public record ErrorBody(String code, String message, Map<String, String> details, String correlationId) {
    }

    public static ErrorResponse of(String code, String message, Map<String, String> details, String correlationId) {
        return new ErrorResponse(false, new ErrorBody(code, message, details == null ? Map.of() : details, correlationId), Instant.now());
    }
}
