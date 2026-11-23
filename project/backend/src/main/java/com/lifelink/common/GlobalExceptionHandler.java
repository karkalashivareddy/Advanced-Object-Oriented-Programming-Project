package com.lifelink.common;

import com.lifelink.common.exception.ErrorCode;
import com.lifelink.common.exception.LifeLinkException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "com.lifelink")
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(LifeLinkException.class)
    public ResponseEntity<ErrorResponse> handleDomain(LifeLinkException ex) {
        if (ex.errorCode().status().is5xxServerError()) {
            log.error("Domain error: {}", ex.getMessage(), ex);
        } else {
            log.warn("Domain error [{}]: {}", ex.errorCode().code(), ex.getMessage());
        }
        return build(ex.errorCode().status(), ex.errorCode().code(), ex.getMessage(), ex.details());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return build(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR.code(), "Request validation failed", fields);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException ex) {
        return build(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR.code(), "Malformed request body", Map.of());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return build(HttpStatus.FORBIDDEN, ErrorCode.UNAUTHORIZED_OPERATION.code(), "Operation is not permitted", Map.of());
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleBadCredentials(BadCredentialsException ex) {
        return build(HttpStatus.UNAUTHORIZED, ErrorCode.AUTHENTICATION_FAILED.code(), "Invalid email or password", Map.of());
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleOptimisticLock(OptimisticLockingFailureException ex) {
        return build(HttpStatus.CONFLICT, ErrorCode.CONCURRENCY_CONFLICT.code(), "The resource changed concurrently; retry the operation", Map.of());
    }

    /** Lock waits and timeouts are transient; clients must be able to retry safely. */
    @ExceptionHandler({CannotAcquireLockException.class, PessimisticLockingFailureException.class,
            QueryTimeoutException.class})
    public ResponseEntity<ErrorResponse> handleLockContention(Exception ex) {
        log.warn("Lock contention: {}", ex.getMessage());
        return build(HttpStatus.CONFLICT, ErrorCode.CONCURRENCY_CONFLICT.code(),
                "The resource is locked or timed out; retry the operation", Map.of());
    }

    /** Unique/FK races are conflicts, not unexpected server failures. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("Data integrity conflict: {}", ex.getMessage());
        return build(HttpStatus.CONFLICT, ErrorCode.CONCURRENCY_CONFLICT.code(),
                "The request conflicts with existing data; retry with a new key", Map.of());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception on {} {}: {}", request.getMethod(), request.getRequestURI(), ex.getMessage(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR.code(),
                "An unexpected error occurred", Map.of());
    }

    private ResponseEntity<ErrorResponse> build(HttpStatus status, String code, String message, Map<String, String> details) {
        return ResponseEntity.status(status)
                .body(ErrorResponse.of(code, message, details, CorrelationContext.id()));
    }
}
