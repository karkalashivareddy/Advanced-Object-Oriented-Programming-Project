package com.lifelink.donor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lifelink.audit.AuditService;
import com.lifelink.common.BloodGroup;
import com.lifelink.common.GeoPoint;
import com.lifelink.common.exception.TenantAccessDeniedException;
import com.lifelink.donor.dto.DonorDtos.LocationPreferenceRequest;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.OrganizationMembershipRepository;
import com.lifelink.identity.Role;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import com.lifelink.organization.OrganizationRepository;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class DonorLocationPreferenceTest {
    private final DonorProfileRepository donors = mock(DonorProfileRepository.class);
    private final ConsentRepository consents = mock(ConsentRepository.class);
    private final AppointmentRepository appointments = mock(AppointmentRepository.class);
    private final DonationRepository donations = mock(DonationRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final OrganizationRepository organizations = mock(OrganizationRepository.class);
    private final OrganizationMembershipRepository memberships = mock(OrganizationMembershipRepository.class);
    private final TenantAccessService access = new TenantAccessService();
    private final AuditService audit = mock(AuditService.class);
    private final User owner = mock(User.class);
    private final DonorProfile profile = new DonorProfile(owner, BloodGroup.O_POSITIVE,
            LocalDate.of(1990, 1, 1), null, null, null, "IN_APP");
    private final DonorService service = new DonorService(donors, consents, appointments, donations,
            users, organizations, memberships, access, audit);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void donorCanGrantAndWithdrawLocationConsentAndWithdrawalClearsCoordinates() {
        when(owner.getId()).thenReturn(41L);
        authenticate(41L);
        when(donors.findById(7L)).thenReturn(java.util.Optional.of(profile));
        when(consents.existsByDonorIdAndTypeAndGrantedTrueAndWithdrawnAtIsNull(7L, "LOCATION_DISCOVERY"))
                .thenReturn(false);

        var enabled = service.updateLocationPreference(7L, new LocationPreferenceRequest(true, 12.97, 77.59));
        assertEquals(true, enabled.consentGranted());
        assertEquals(new GeoPoint(12.97, 77.59), profile.location());

        ConsentRecord active = new ConsentRecord(profile, "LOCATION_DISCOVERY", true);
        when(consents.findByDonorIdAndTypeAndGrantedTrueAndWithdrawnAtIsNull(7L, "LOCATION_DISCOVERY"))
                .thenReturn(List.of(active));
        var disabled = service.updateLocationPreference(7L, new LocationPreferenceRequest(false, null, null));

        assertEquals(false, disabled.consentGranted());
        assertNull(profile.location());
        assertEquals(false, active.isGranted());
    }

    @Test
    void anotherUserCannotChangeLocationConsent() {
        when(owner.getId()).thenReturn(41L);
        authenticate(42L);
        when(donors.findById(7L)).thenReturn(java.util.Optional.of(profile));

        assertThrows(TenantAccessDeniedException.class,
                () -> service.updateLocationPreference(7L, new LocationPreferenceRequest(true, 12.97, 77.59)));
        verify(consents, never()).save(any());
    }

    private void authenticate(Long userId) {
        AuthenticatedUser user = new AuthenticatedUser(userId, "synthetic@example.test", "Synthetic",
                EnumSet.of(Role.DONOR), Set.of(), Set.of(), Set.of());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }
}
