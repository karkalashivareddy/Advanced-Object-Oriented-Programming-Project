package com.lifelink.common.exception;

public class RateLimitedException extends LifeLinkException {
    public RateLimitedException(String message) {
        super(ErrorCode.RATE_LIMITED, message);
    }
}
