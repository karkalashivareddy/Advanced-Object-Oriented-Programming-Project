package com.lifelink.common.exception;

public class InvalidStateTransitionException extends LifeLinkException {
    public InvalidStateTransitionException(String from, String to) {
        super(ErrorCode.INVALID_STATE_TRANSITION, "Invalid state transition: " + from + " -> " + to);
    }

    public InvalidStateTransitionException(String message) {
        super(ErrorCode.INVALID_STATE_TRANSITION, message);
    }
}
