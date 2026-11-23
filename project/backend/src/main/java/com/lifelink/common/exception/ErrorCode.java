package com.lifelink.common.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR"),
    RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND"),
    BUSINESS_RULE_VIOLATION(HttpStatus.CONFLICT, "BUSINESS_RULE_VIOLATION"),
    INVALID_STATE_TRANSITION(HttpStatus.CONFLICT, "INVALID_STATE_TRANSITION"),
    INSUFFICIENT_INVENTORY(HttpStatus.CONFLICT, "INSUFFICIENT_INVENTORY"),
    CONCURRENCY_CONFLICT(HttpStatus.CONFLICT, "CONCURRENCY_CONFLICT"),
    UNAUTHORIZED_OPERATION(HttpStatus.FORBIDDEN, "UNAUTHORIZED_OPERATION"),
    TENANT_ACCESS_DENIED(HttpStatus.FORBIDDEN, "TENANT_ACCESS_DENIED"),
    AUTHENTICATION_FAILED(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_FAILED"),
    TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "TOKEN_INVALID"),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR");

    private final HttpStatus status;
    private final String code;

    ErrorCode(HttpStatus status, String code) {
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }
}
