package com.lifelink.common.exception;

public class TenantAccessDeniedException extends LifeLinkException {
    public TenantAccessDeniedException(Long organizationId) {
        super(ErrorCode.TENANT_ACCESS_DENIED, "Access to organization " + organizationId + " is denied");
    }
}
