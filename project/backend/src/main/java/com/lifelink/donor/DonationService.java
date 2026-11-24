package com.lifelink.donor;

import com.lifelink.audit.AuditService;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.common.exception.ValidationException;
import com.lifelink.donor.dto.DonationDtos.ApprovalRequest;
import com.lifelink.donor.dto.DonationDtos.CreateRequest;
import com.lifelink.donor.dto.DonationDtos.RejectRequest;
import com.lifelink.donor.dto.DonationDtos.ScreeningRequest;
import com.lifelink.donor.dto.DonationDtos.View;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.OrganizationMembershipRepository;
import com.lifelink.identity.Permission;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import com.lifelink.inventory.InventoryService;
import com.lifelink.inventory.dto.InventoryDtos;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DonationService {
    private final DonationRepository repository;
    private final DonorProfileRepository donorRepository;
    private final AppointmentRepository appointmentRepository;
    private final ScreeningRepository screeningRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final OrganizationMembershipRepository membershipRepository;
    private final InventoryService inventoryService;
    private final TenantAccessService tenantAccess;
    private final AuditService auditService;

    public DonationService(DonationRepository repository, DonorProfileRepository donorRepository,
                           AppointmentRepository appointmentRepository, ScreeningRepository screeningRepository,
                           OrganizationRepository organizationRepository, UserRepository userRepository,
                           OrganizationMembershipRepository membershipRepository, InventoryService inventoryService,
                           TenantAccessService tenantAccess, AuditService auditService) {
        this.repository = repository;
        this.donorRepository = donorRepository;
        this.appointmentRepository = appointmentRepository;
        this.screeningRepository = screeningRepository;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.inventoryService = inventoryService;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<View> list(Long donorId, Long organizationId) {
        AuthenticatedUser user = tenantAccess.currentUser();
        if (donorId != null) {
            var donations = repository.findByDonorIdOrderByDonatedAtDesc(donorId);
            if (user.isPlatformAdmin()) {
                return donations.stream().map(View::of).toList();
            }
            DonorProfile donor = donorRepository.findById(donorId)
                    .orElseThrow(() -> new ResourceNotFoundException("DonorProfile", donorId));
            if (donor.getUser().getId().equals(user.userId())) {
                return donations.stream().map(View::of).toList();
            }
            return donations.stream()
                    .filter(donation -> user.belongsTo(donation.getOrganization().getId())
                            && user.hasPermissionForOrganization(Permission.DONATION_READ,
                                    donation.getOrganization().getId()))
                    .map(View::of).toList();
        }
        Long org = tenantAccess.requireActiveOrganization(organizationId);
        tenantAccess.requireOrganizationAndPermission(org, Permission.DONATION_READ);
        return repository.findByOrganizationIdOrderByDonatedAtDesc(org).stream().map(View::of).toList();
    }

    @Transactional(readOnly = true)
    public View get(Long id) {
        Donation donation = find(id);
        tenantAccess.requireOrganizationAndPermission(donation.getOrganization().getId(),
                Permission.DONATION_READ);
        return View.of(donation);
    }

    @Transactional
    public View record(CreateRequest request) {
        tenantAccess.requireOrganizationAndPermission(request.organizationId(), Permission.DONATION_RECORD);
        DonorProfile donor = donorRepository.findById(request.donorId())
                .orElseThrow(() -> new ResourceNotFoundException("DonorProfile", request.donorId()));
        Organization organization = organizationRepository.findById(request.organizationId())
                .orElseThrow(() -> new ResourceNotFoundException("Organization", request.organizationId()));
        requireDonorOrganizationLink(donor, organization.getId());
        Appointment appointment = request.appointmentId() == null ? null
                : appointmentRepository.findById(request.appointmentId())
                        .orElseThrow(() -> new ResourceNotFoundException("Appointment", request.appointmentId()));
        if (appointment != null) {
            if (!appointment.getDonor().getId().equals(donor.getId())
                    || !appointment.getOrganization().getId().equals(organization.getId())) {
                throw new BusinessRuleViolationException(
                        "Appointment must belong to the same donor and organization as the donation");
            }
            if (appointment.getStatus() == Appointment.Status.CANCELLED
                    || appointment.getStatus() == Appointment.Status.REJECTED) {
                throw new BusinessRuleViolationException("A cancelled or rejected appointment cannot be donated against");
            }
        }
        Instant donatedAt = request.donatedAt() == null ? Instant.now() : request.donatedAt();
        Donation donation = new Donation(donor, organization, appointment, donatedAt, request.notes());
        repository.save(donation);
        auditService.record("DONATION_RECORD", "DONATION", donation.getPublicId(),
                organization.getId(), "SUCCESS", Map.of());
        return View.of(donation);
    }

    @Transactional
    public View screen(Long id, ScreeningRequest request) {
        Donation donation = find(id);
        tenantAccess.requireOrganizationAndPermission(donation.getOrganization().getId(),
                Permission.SCREENING_REVIEW);
        User actor = userRepository.findById(tenantAccess.currentUser().userId())
                .orElseThrow(() -> new ResourceNotFoundException("User", tenantAccess.currentUser().userId()));
        ScreeningRecord screening = new ScreeningRecord(donation, request.passed(), request.notes(), actor);
        donation.screen(request.passed());
        screeningRepository.save(screening);
        auditService.record("DONATION_SCREEN", "DONATION", donation.getPublicId(),
                donation.getOrganization().getId(), "SUCCESS", Map.of("passed", String.valueOf(request.passed())));
        return View.of(donation);
    }

    @Transactional
    public View approve(Long id, ApprovalRequest request) {
        Donation donation = find(id);
        tenantAccess.requireOrganizationAndPermission(donation.getOrganization().getId(),
                Permission.DONATION_APPROVE);
        List<ScreeningRecord> screenings = screeningRepository.findByDonationIdOrderByCreatedAtDesc(id);
        if (screenings.isEmpty() || !screenings.get(0).isPassed()) {
            throw new BusinessRuleViolationException("Donation cannot be approved without a passing screening");
        }
        donation.approve();
        List<InventoryDtos.View> units = inventoryService.createFromDonation(donation, request.components());
        auditService.record("DONATION_APPROVE", "DONATION", donation.getPublicId(),
                donation.getOrganization().getId(), "SUCCESS", Map.of("unitCount", String.valueOf(units.size())));
        return View.of(donation);
    }

    @Transactional
    public View reject(Long id, RejectRequest request) {
        if (request == null || request.reason() == null || request.reason().isBlank()) {
            throw new ValidationException("Reason is required", Map.of("reason", "must not be blank"));
        }
        Donation donation = find(id);
        tenantAccess.requireOrganizationAndPermission(donation.getOrganization().getId(),
                Permission.DONATION_APPROVE);
        donation.reject();
        auditService.record("DONATION_REJECT", "DONATION", donation.getPublicId(),
                donation.getOrganization().getId(), "SUCCESS", Map.of("reason", request.reason()));
        return View.of(donation);
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.View> units(Long id) {
        Donation donation = find(id);
        tenantAccess.requireOrganizationAndPermission(donation.getOrganization().getId(),
                Permission.DONATION_READ);
        return inventoryService.unitsForDonation(id);
    }

    /**
     * Donation provenance must stay inside one tenant. A donor is linkable to an
     * organization through a membership or an existing appointment/donation in
     * that organization; an arbitrary donor ID in another tenant is rejected.
     */
    private void requireDonorOrganizationLink(DonorProfile donor, Long organizationId) {
        Long donorUserId = donor.getUser().getId();
        if (membershipRepository.existsByUserIdAndOrganizationId(donorUserId, organizationId)
                || repository.existsByDonorIdAndOrganizationId(donor.getId(), organizationId)
                || appointmentRepository.existsByDonorIdAndOrganizationId(donor.getId(), organizationId)) {
            return;
        }
        throw new BusinessRuleViolationException("Donor is not associated with the recording organization");
    }

    private Donation find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Donation", id));
    }
}
