package com.lifelink.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lifelink.audit.AuditController;
import com.lifelink.audit.AuditService;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.TenantAccessDeniedException;
import com.lifelink.donor.Appointment;
import com.lifelink.donor.AppointmentRepository;
import com.lifelink.donor.Donation;
import com.lifelink.donor.DonationRepository;
import com.lifelink.donor.DonationService;
import com.lifelink.donor.DonorProfile;
import com.lifelink.donor.DonorProfileRepository;
import com.lifelink.donor.ScreeningRepository;
import com.lifelink.donor.dto.DonationDtos.CreateRequest;
import com.lifelink.donor.dto.DonationDtos.View;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.OrganizationMembershipRepository;
import com.lifelink.identity.Permission;
import com.lifelink.identity.Role;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import com.lifelink.inventory.InventoryService;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;

/** Regression tests for the tenant-boundary findings in the independent security audit. */
class TenantBoundaryRegressionTest {

    private DonationRepository donationRepository;
    private DonorProfileRepository donorRepository;
    private AppointmentRepository appointmentRepository;
    private OrganizationRepository organizationRepository;
    private UserRepository userRepository;
    private OrganizationMembershipRepository membershipRepository;
    private TenantAccessService tenantAccess;
    private DonationService donationService;

    private User donorUser;
    private DonorProfile donor;
    private Organization bank;

    @BeforeEach
    void setUp() {
        donationRepository = mock(DonationRepository.class);
        donorRepository = mock(DonorProfileRepository.class);
        appointmentRepository = mock(AppointmentRepository.class);
        organizationRepository = mock(OrganizationRepository.class);
        userRepository = mock(UserRepository.class);
        membershipRepository = mock(OrganizationMembershipRepository.class);
        tenantAccess = mock(TenantAccessService.class);
        donationService = new DonationService(donationRepository, donorRepository, appointmentRepository,
                mock(ScreeningRepository.class), organizationRepository, userRepository, membershipRepository,
                mock(InventoryService.class), tenantAccess, mock(com.lifelink.audit.AuditService.class));

        donorUser = mock(User.class);
        when(donorUser.getId()).thenReturn(3L);
        when(donorUser.getFullName()).thenReturn("Demo Donor");
        donor = mock(DonorProfile.class);
        when(donor.getId()).thenReturn(7L);
        when(donor.getUser()).thenReturn(donorUser);
        bank = mock(Organization.class);
        when(bank.getId()).thenReturn(10L);
        when(donorRepository.findById(7L)).thenReturn(Optional.of(donor));
        when(organizationRepository.findById(10L)).thenReturn(Optional.of(bank));
    }

    @Test
    void recordRejectsDonorWithNoLinkToRecordingOrganization() {
        BusinessRuleViolationException ex = assertThrows(BusinessRuleViolationException.class,
                () -> donationService.record(new CreateRequest(7L, 10L, null, Instant.now().minusSeconds(60), null)));
        assertEquals("Donor is not associated with the recording organization", ex.getMessage());
        verify(donationRepository, never()).save(org.mockito.ArgumentMatchers.any(Donation.class));
    }

    @Test
    void recordAcceptsDonorLinkedByMembership() {
        when(membershipRepository.existsByUserIdAndOrganizationId(3L, 10L)).thenReturn(true);
        View view = donationService.record(
                new CreateRequest(7L, 10L, null, Instant.now().minusSeconds(60), "linked donor"));
        assertEquals(10L, view.organizationId());
        verify(donationRepository).save(org.mockito.ArgumentMatchers.any(Donation.class));
    }

    @Test
    void recordRejectsAppointmentFromDifferentDonorOrOrganization() {
        when(membershipRepository.existsByUserIdAndOrganizationId(3L, 10L)).thenReturn(true);
        Appointment appointment = mock(Appointment.class);
        DonorProfile otherDonor = mock(DonorProfile.class);
        when(otherDonor.getId()).thenReturn(99L);
        when(appointment.getDonor()).thenReturn(otherDonor);
        when(appointment.getOrganization()).thenReturn(bank);
        when(appointmentRepository.findById(11L)).thenReturn(Optional.of(appointment));

        BusinessRuleViolationException ex = assertThrows(BusinessRuleViolationException.class,
                () -> donationService.record(new CreateRequest(7L, 10L, 11L, Instant.now().minusSeconds(60), null)));
        assertEquals("Appointment must belong to the same donor and organization as the donation", ex.getMessage());
    }

    @Test
    void auditControllerRequiresExplicitScopeForMultiOrganizationUsers() {
        AuditService service = mock(AuditService.class);
        TenantAccessService access = mock(TenantAccessService.class);
        AuthenticatedUser user = new AuthenticatedUser(1L, "user@lifelink.local", "User",
                Set.of(Role.BLOOD_BANK_ADMIN), Set.of(Permission.AUDIT_READ), Set.of(1L, 2L), Set.of());
        when(access.currentUser()).thenReturn(user);
        AuditController controller = new AuditController(service, access);

        assertThrows(BusinessRuleViolationException.class,
                () -> controller.list(null, null, null, null, null, PageRequest.of(0, 10)));

        doThrow(new TenantAccessDeniedException(2L)).when(access)
                .requireOrganizationAndPermission(2L, Permission.AUDIT_READ);
        assertThrows(TenantAccessDeniedException.class,
                () -> controller.list(2L, null, null, null, null, PageRequest.of(0, 10)));
        verify(service, never()).search(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }
}
