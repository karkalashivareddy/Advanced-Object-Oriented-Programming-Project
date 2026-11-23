package com.lifelink.identity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.lifelink.common.exception.ErrorCode;
import com.lifelink.common.exception.LifeLinkException;
import com.lifelink.common.exception.TenantAccessDeniedException;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

class TenantAccessServiceTest {
    private final TenantAccessService service = new TenantAccessService();

    @AfterEach
    void clearContexts() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void validHeaderSelectsOneOfTheUsersOrganizations() {
        authenticate(user(Set.of(10L, 20L), false));
        MockHttpServletRequest request = requestWithHeader("20");

        assertEquals(20L, service.currentOrganizationId());
        assertEquals(20L, service.requireCurrentOrganization());
        // The selection is validated once and cached on the request.
        request.addHeader(TenantAccessService.ORGANIZATION_HEADER, "10");
        assertEquals(20L, service.currentOrganizationId());
    }

    @Test
    void headerCannotSelectAnOrganizationTheUserDoesNotBelongTo() {
        authenticate(user(Set.of(10L, 20L), false));
        requestWithHeader("99");

        assertThrows(TenantAccessDeniedException.class, () -> service.currentOrganizationId());
    }

    @Test
    void malformedHeaderIsAValidationError() {
        authenticate(user(Set.of(10L), false));
        requestWithHeader("not-a-number");

        LifeLinkException failure = assertThrows(LifeLinkException.class, () -> service.currentOrganizationId());
        assertEquals(ErrorCode.VALIDATION_ERROR, failure.errorCode());
    }

    @Test
    void platformAdminCanSelectAnyOrganizationButStillNeedsAnExplicitChoice() {
        authenticate(user(Set.of(), true));
        requestWithHeader("99");

        assertEquals(99L, service.currentOrganizationId());
        RequestContextHolder.resetRequestAttributes();
        assertThrows(com.lifelink.common.exception.UnauthorizedOperationException.class,
                () -> service.requireCurrentOrganization());
    }

    @Test
    void withoutARequestTheSingleMembershipIsTheDefault() {
        authenticate(user(Set.of(10L), false));

        assertEquals(10L, service.currentOrganizationId());
    }

    @Test
    void withoutARequestOrSingleMembershipThereIsNoImplicitOrganization() {
        authenticate(user(Set.of(10L, 20L), false));

        assertNull(service.currentOrganizationId());
    }

    private void authenticate(AuthenticatedUser user) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }

    private MockHttpServletRequest requestWithHeader(String value) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(TenantAccessService.ORGANIZATION_HEADER, value);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        return request;
    }

    private AuthenticatedUser user(Set<Long> organizationIds, boolean platformAdmin) {
        return new AuthenticatedUser(1L, "member@example.test", "Test Member",
                platformAdmin ? Set.of(Role.PLATFORM_ADMIN) : Set.of(Role.DONOR),
                Set.of(Permission.NOTIFICATION_READ), organizationIds, Set.of());
    }
}
