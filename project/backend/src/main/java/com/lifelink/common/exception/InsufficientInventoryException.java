package com.lifelink.common.exception;

public class InsufficientInventoryException extends LifeLinkException {
    public InsufficientInventoryException(String message) {
        super(ErrorCode.INSUFFICIENT_INVENTORY, message);
    }
}
