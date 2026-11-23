package com.lifelink.identity;

import com.lifelink.audit.AuditService;
import com.lifelink.common.PageResponse;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.identity.dto.AuthDtos.UserView;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final TenantAccessService tenantAccess;
    private final AuthService authService;
    private final AuditService auditService;

    public UserService(UserRepository userRepository, TenantAccessService tenantAccess,
                       AuthService authService, AuditService auditService) {
        this.userRepository = userRepository;
        this.tenantAccess = tenantAccess;
        this.authService = authService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResponse<UserView> list(String search, Pageable pageable) {
        tenantAccess.requirePermission(Permission.USER_READ);
        Page<User> page = search == null || search.isBlank()
                ? userRepository.findAll(pageable)
                : userRepository.findByEmailContainingIgnoreCaseOrFullNameContainingIgnoreCase(search, search, pageable);
        return PageResponse.from(page, authService::toView);
    }

    @Transactional
    public UserView changeStatus(Long id, User.Status status) {
        tenantAccess.requirePermission(Permission.USER_MANAGE);
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
        switch (status) {
            case ACTIVE -> user.activate();
            case LOCKED -> user.lock();
            case DISABLED -> user.disable();
            case PENDING_VERIFICATION -> user.markPendingVerification();
        }
        if (status != User.Status.ACTIVE) {
            authService.revokeAllForUser(user);
        }
        auditService.record("USER_STATUS", "USER", user.getPublicId(), null, "SUCCESS",
                Map.of("status", status.name()));
        return authService.toView(user);
    }
}
