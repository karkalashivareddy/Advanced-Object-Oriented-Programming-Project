package com.lifelink.common.exception;

public class ConcurrencyConflictException extends LifeLinkException {
    public ConcurrencyConflictException(String message) {
        super(ErrorCode.CONCURRENCY_CONFLICT, message);
    }
}
