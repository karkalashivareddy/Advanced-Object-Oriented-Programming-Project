package com.lifelink.common;

import java.util.UUID;
import org.slf4j.MDC;

public final class CorrelationContext {
    private static final String KEY = "correlationId";

    private CorrelationContext() {
    }

    public static String id() {
        String existing = MDC.get(KEY);
        return existing == null || existing.isBlank() ? "bootstrap" : existing;
    }

    public static String begin(String requested) {
        String id = requested != null && !requested.isBlank() && requested.length() <= 64
                ? requested : UUID.randomUUID().toString();
        MDC.put(KEY, id);
        return id;
    }

    public static void clear() {
        MDC.remove(KEY);
    }
}
