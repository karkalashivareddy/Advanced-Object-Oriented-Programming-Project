package com.lifelink.donor;

import com.lifelink.audit.AuditService;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.donor.dto.DonationDtos.ApprovalRequest;
import com.lifelink.donor.dto.DonationDtos.CreateRequest;
import com.lifelink.donor.dto.DonationDtos.RejectRequest;
import com.lifelink.donor.dto.DonationDtos.ScreeningRequest;
import com.lifelink.donor.dto.DonationDtos.View;
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
    private final InventoryService inventoryService;
    private final TenantAccessService tenantAccess;
    private final AuditService auditService;

    public DonationService(DonationRepository repository, DonorProfileRepository donorRepository,
                           AppointmentRepository appointmentRepository, ScreeningRepository screeningRepository,
                           OrganizationRepository organizationRepository, UserRepository userRepository,
                           InventoryService inventoryService, TenantAccessService tenantAccess,
                           AuditService auditService) {
        this.repository = repository;
        this.donorRepository = donorRepository;
        this.appointmentRepository = appointmentRepository;
        this.screeningRepository = screeningRepository;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.inventoryService = inventoryService;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<View> list(Long donorId, Long organizationId) {
        tenantAccess.requirePermission(Permission.DONATION_READ);
        if (donorId != null) {
            return repository.findByDonorIdOrderByDonatedAtDesc(donorId).stream().map(View::of).toList();
        }
        Long org = tenantAccess.requireActiveOrganization(organizationId);
        return repository.findByOrganizationIdOrderByDonatedAtDesc(org).stream().map(View::of).toList();
    }

    @Transactional(readOnly = true)
    public View get(Long id) {
        tenantAccess.requirePermission(Permission.DONATION_READ);
        Donation donation = find(id);
        tenantAccess.requireOrganization(donation.getOrganization().getId());
        return View.of(donation);
    }

    @Transactional
    public View record(CreateRequest request) {
        tenantAccess.requireOrganizationAndPermission(request.organizationId(), Permission.DONATION_RECORD);
        DonorProfile donor = donorRepository.findById(request.donorId())
                .orElseThrow(() -> new ResourceNotFoundException("DonorProfile", request.donorId()));
        Organization organization = organizationRepository.findById(request.organizationId())
                .orElseThrow(() -> new ResourceNotFoundException("Organization", request.organizationId()));
        Appointment appointment = request.appointmentId() == null ? null
                : appointmentRepository.findById(request.appointmentId())
                        .orElseThrow(() -> new ResourceNotFoundException("Appointment", request.appointmentId()));
        Instant donatedAt = request.donatedAt() == null ? Instant.now() : request.donatedAt();
        Donation donation = new Donation(donor, organization, appointment, donatedAt, request.notes());
        repository.save(donation);
        auditService.record("DONATION_RECORD", "DONATION", donation.getPublicId(),
                organization.getId(), "SUCCESS", Map.of());
        return View.of(donation);
    }

    @Transactional
    public View screen(Long id, ScreeningRequest request) {
        tenantAccess.requirePermission(Permission.SCREENING_REVIEW);
        Donation donation = find(id);
        tenantAccess.requireOrganization(donation.getOrganization().getId());
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
        tenantAccess.requirePermission(Permission.DONATION_APPROVE);
        Donation donation = find(id);
        tenantAccess.requireOrganization(donation.getOrganization().getId());
        List<ScreeningRecord> screenings = screeningRepository.findByDonationId(id);
        if (screenings.isEmpty() || !screenings.get(screenings.size() - 1).isPassed()) {
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
        tenantAccess.requirePermission(Permission.DONATION_APPROVE);
        Donation donation = find(id);
        tenantAccess.requireOrganization(donation.getOrganization().getId());
        donation.reject();
        auditService.record("DONATION_REJECT", "DONATION", donation.getPublicId(),
                donation.getOrganization().getId(), "SUCCESS", Map.of("reason", request.reason()));
        return View.of(donation);
    }

    @Transactional(readOnly = true)
    public List<InventoryDtos.View> units(Long id) {
        tenantAccess.requirePermission(Permission.DONATION_READ);
        Donation donation = find(id);
        tenantAccess.requireOrganization(donation.getOrganization().getId());
        return inventoryService.unitsForDonation(id);
    }

    private Donation find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Donation", id));
    }
}
