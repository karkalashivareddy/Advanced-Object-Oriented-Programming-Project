package com.lifelink.common.exception;

import java.util.Map;

public abstract class LifeLinkException extends RuntimeException {
    private final ErrorCode errorCode;
    private final Map<String, String> details;

    protected LifeLinkException(ErrorCode errorCode, String message) {
        this(errorCode, message, Map.of());
    }

    protected LifeLinkException(ErrorCode errorCode, String message, Map<String, String> details) {
        super(message);
        this.errorCode = errorCode;
        this.details = details == null ? Map.of() : Map.copyOf(details);
    }

    public ErrorCode errorCode() {
        return errorCode;
    }

    public Map<String, String> details() {
        return details;
    }
}
