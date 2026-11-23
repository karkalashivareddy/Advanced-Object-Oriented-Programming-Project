package com.lifelink.common.exception;

public class UnauthorizedOperationException extends LifeLinkException {
    public UnauthorizedOperationException(String message) {
        super(ErrorCode.UNAUTHORIZED_OPERATION, message);
    }
}
