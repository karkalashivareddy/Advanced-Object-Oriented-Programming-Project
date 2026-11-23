package com.lifelink.common.exception;

public class AuthenticationFailedException extends LifeLinkException {
    public AuthenticationFailedException(String message) {
        super(ErrorCode.AUTHENTICATION_FAILED, message);
    }
}
