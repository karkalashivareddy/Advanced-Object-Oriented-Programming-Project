package com.lifelink.common.exception;

import java.util.Map;

/** Input rejected by a service when bean validation could not run at the boundary. */
public class ValidationException extends LifeLinkException {
    public ValidationException(String message) {
        super(ErrorCode.VALIDATION_ERROR, message);
    }

    public ValidationException(String message, Map<String, String> details) {
        super(ErrorCode.VALIDATION_ERROR, message, details);
    }
}
