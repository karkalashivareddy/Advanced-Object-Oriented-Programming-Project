package com.lifelink.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.lifelink.common.GlobalExceptionHandler;
import com.lifelink.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/** Lock waits/timeouts and integrity races must be retryable 409s, never 500s. */
class ConcurrencyExceptionMappingTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void lockContentionAndIntegrityFailuresMapToConcurrencyConflict() {
        assertConflict(handler.handleLockContention(new CannotAcquireLockException("lock unavailable")));
        assertConflict(handler.handleLockContention(new PessimisticLockingFailureException("lock timed out")));
        assertConflict(handler.handleLockContention(new QueryTimeoutException("statement timed out")));
        assertConflict(handler.handleDataIntegrity(new DataIntegrityViolationException("duplicate key")));
    }

    private void assertConflict(ResponseEntity<?> response) {
        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        com.lifelink.common.ErrorResponse body = (com.lifelink.common.ErrorResponse) response.getBody();
        assertEquals(ErrorCode.CONCURRENCY_CONFLICT.code(), body.error().code());
    }
}
