package com.lifelink.common;

import com.lifelink.common.exception.ErrorCode;
import com.lifelink.common.exception.LifeLinkException;
import java.util.Map;

/** Shared validation for client-supplied replay keys before they reach transactional code. */
public final class IdempotencyKeys {
    public static final int MAX_LENGTH = 120;

    private IdempotencyKeys() {
    }

    /** Blank headers are treated as absent by existing callers; overlong keys are client errors. */
    public static void validateHeader(String key) {
        if (key != null && key.length() > MAX_LENGTH) {
            throw new InvalidIdempotencyKeyException();
        }
    }

    public static final class InvalidIdempotencyKeyException extends LifeLinkException {
        InvalidIdempotencyKeyException() {
            super(ErrorCode.VALIDATION_ERROR, "Idempotency-Key must be at most " + MAX_LENGTH + " characters",
                    Map.of("Idempotency-Key", "must be at most " + MAX_LENGTH + " characters"));
        }
    }
}
