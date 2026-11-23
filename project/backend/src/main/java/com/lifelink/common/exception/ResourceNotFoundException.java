package com.lifelink.common.exception;

public class ResourceNotFoundException extends LifeLinkException {
    public ResourceNotFoundException(String resource, Object identifier) {
        super(ErrorCode.RESOURCE_NOT_FOUND, resource + " not found: " + identifier);
    }
}
