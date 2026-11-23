package com.lifelink.common;

import java.time.Instant;

public record ApiResponse<T>(boolean success, T data, String message, String correlationId, Instant timestamp) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null, CorrelationContext.id(), Instant.now());
    }

    public static <T> ApiResponse<T> ok(T data, String message) {
        return new ApiResponse<>(true, data, message, CorrelationContext.id(), Instant.now());
    }
}
