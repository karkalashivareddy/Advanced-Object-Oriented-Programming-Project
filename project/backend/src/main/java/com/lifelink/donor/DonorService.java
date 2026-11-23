package com.lifelink.donor;

import com.lifelink.audit.AuditService;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.common.exception.TenantAccessDeniedException;
import com.lifelink.donor.dto.DonorDtos.AppointmentActionRequest;
import com.lifelink.donor.dto.DonorDtos.AppointmentRequest;
import com.lifelink.donor.dto.DonorDtos.AppointmentView;
import com.lifelink.donor.dto.DonorDtos.ConsentRequest;
import com.lifelink.donor.dto.DonorDtos.ConsentView;
import com.lifelink.donor.dto.DonorDtos.CreateProfileRequest;
import com.lifelink.donor.dto.DonorDtos.ProfileView;
import com.lifelink.donor.dto.DonorDtos.UpdateProfileRequest;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DonorService {
    private final DonorProfileRepository donorRepository;
    private final ConsentRepository consentRepository;
    private final AppointmentRepository appointmentRepository;
    private final DonationRepository donationRepository;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final TenantAccessService tenantAccess;
    private final AuditService auditService;

    public DonorService(DonorProfileRepository donorRepository, ConsentRepository consentRepository,
                        AppointmentRepository appointmentRepository, DonationRepository donationRepository,
                        UserRepository userRepository, OrganizationRepository organizationRepository,
                        TenantAccessService tenantAccess, AuditService auditService) {
        this.donorRepository = donorRepository;
        this.consentRepository = consentRepository;
        this.appointmentRepository = appointmentRepository;
        this.donationRepository = donationRepository;
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<ProfileView> list() {
        AuthenticatedUser user = tenantAccess.currentUser();
        tenantAccess.requirePermission(Permission.DONOR_READ);
        if (user.isPlatformAdmin()) {
            return donorRepository.findAll().stream().map(ProfileView::of).toList();
        }
        Set<Long> donorIds = donationRepository.findAll().stream()
                .filter(d -> user.belongsTo(d.getOrganization().getId())
                        && user.hasPermissionForOrganization(Permission.DONOR_READ, d.getOrganization().getId()))
                .map(d -> d.getDonor().getId())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        donorIds.addAll(donorRepository.findAll().stream()
                .filter(d -> d.getUser().getId().equals(user.userId()))
                .map(DonorProfile::getId).toList());
        return donorRepository.findAllById(donorIds).stream().map(ProfileView::of).toList();
    }

    @Transactional(readOnly = true)
    public ProfileView get(Long id) {
        DonorProfile profile = find(id);
        requireDonorAccess(profile, Permission.DONOR_READ);
        return ProfileView.of(profile);
    }

    @Transactional
    public ProfileView create(CreateProfileRequest request) {
        AuthenticatedUser current = tenantAccess.currentUser();
        Long targetUserId = request.userId() == null ? current.userId() : request.userId();
        if (!targetUserId.equals(current.userId())) {
            tenantAccess.requirePermission(Permission.DONOR_MANAGE);
        }
        if (donorRepository.findByUserId(targetUserId).isPresent()) {
            throw new BusinessRuleViolationException("A donor profile already exists for this user");
        }
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", targetUserId));
        DonorProfile profile = new DonorProfile(user, request.bloodGroup(), request.dateOfBirth(),
                request.address(), request.city(), request.state(), request.preferredContact());
        donorRepository.save(profile);
        auditService.record("DONOR_PROFILE_CREATE", "DONOR", profile.getPublicId(), null, "SUCCESS", Map.of());
        return ProfileView.of(profile);
    }

    @Transactional
    public ProfileView update(Long id, UpdateProfileRequest request) {
        DonorProfile profile = find(id);
        requireDonorAccess(profile, Permission.DONOR_MANAGE);
        profile.updateContact(request.address(), request.city(), request.state(), request.preferredContact());
        if (request.availability() != null) {
            profile.setAvailability(request.availability());
        }
        auditService.record("DONOR_PROFILE_UPDATE", "DONOR", profile.getPublicId(), null, "SUCCESS", Map.of());
        return ProfileView.of(profile);
    }

    @Transactional
    public ConsentView addConsent(Long donorId, ConsentRequest request) {
        DonorProfile profile = find(donorId);
        requireDonorAccess(profile, Permission.DONOR_MANAGE);
        ConsentRecord consent = new ConsentRecord(profile, request.type(), request.granted());
        consentRepository.save(consent);
        auditService.record("CONSENT_RECORD", "DONOR", profile.getPublicId(), null, "SUCCESS",
                Map.of("type", request.type()));
        return ConsentView.of(consent);
    }

    @Transactional(readOnly = true)
    public List<ConsentView> consents(Long donorId) {
        requireDonorAccess(find(donorId), Permission.DONOR_READ);
        return consentRepository.findByDonorId(donorId).stream().map(ConsentView::of).toList();
    }

    @Transactional
    public void withdrawConsent(Long donorId, Long consentId) {
        DonorProfile profile = find(donorId);
        requireDonorAccess(profile, Permission.DONOR_MANAGE);
        ConsentRecord consent = consentRepository.findById(consentId)
                .orElseThrow(() -> new ResourceNotFoundException("Consent", consentId));
        if (!consent.getDonor().getId().equals(donorId)) {
            throw new ResourceNotFoundException("Consent", consentId);
        }
        consent.withdraw(Instant.now());
        auditService.record("CONSENT_WITHDRAW", "DONOR", profile.getPublicId(), null, "SUCCESS", Map.of());
    }

    @Transactional
    public AppointmentView requestAppointment(Long donorId, AppointmentRequest request) {
        DonorProfile profile = find(donorId);
        AuthenticatedUser current = tenantAccess.currentUser();
        if (!profile.getUser().getId().equals(current.userId())) {
            tenantAccess.requirePermission(Permission.APPOINTMENT_MANAGE);
        }
        boolean donorSelfBooking = profile.getUser().getId().equals(current.userId());
        Long organizationId = donorSelfBooking && request.organizationId() != null
                ? request.organizationId()
                : tenantAccess.requireActiveOrganization(request.organizationId());
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization", organizationId));
        if (donorSelfBooking && (organization.getType() != Organization.Type.BLOOD_BANK || !organization.isVerified())) {
            throw new BusinessRuleViolationException("Appointments require a verified blood bank");
        }
        if (!donorSelfBooking) {
            tenantAccess.requireOrganizationAndPermission(organizationId, Permission.APPOINTMENT_MANAGE);
        }
        Appointment appointment = new Appointment(profile, organization, request.scheduledAt(), request.notes());
        appointmentRepository.save(appointment);
        auditService.record("APPOINTMENT_REQUEST", "APPOINTMENT", appointment.getPublicId(),
                organizationId, "SUCCESS", Map.of());
        return AppointmentView.of(appointment);
    }

    @Transactional
    public AppointmentView actionAppointment(Long appointmentId, AppointmentActionRequest request) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", appointmentId));
        tenantAccess.requireOrganizationAndPermission(appointment.getOrganization().getId(),
                Permission.APPOINTMENT_MANAGE);
        switch (request.action() == null ? "" : request.action().toUpperCase()) {
            case "CONFIRM" -> appointment.confirm();
            case "COMPLETE" -> appointment.complete();
            case "CANCEL" -> appointment.cancel();
            case "REJECT" -> appointment.reject();
            default -> throw new BusinessRuleViolationException("Unknown appointment action");
        }
        auditService.record("APPOINTMENT_" + request.action().toUpperCase(), "APPOINTMENT",
                appointment.getPublicId(), appointment.getOrganization().getId(), "SUCCESS", Map.of());
        return AppointmentView.of(appointment);
    }

    @Transactional(readOnly = true)
    public List<AppointmentView> appointments(Long donorId) {
        requireDonorAccess(find(donorId), Permission.DONOR_READ);
        return appointmentRepository.findByDonorIdOrderByScheduledAtDesc(donorId)
                .stream().map(AppointmentView::of).toList();
    }

    /** Owner access is allowed for a donor's own records; staff access must be scoped to an organization that owns a donation for that donor. */
    private void requireDonorAccess(DonorProfile profile, Permission permission) {
        AuthenticatedUser user = tenantAccess.currentUser();
        if (user.isPlatformAdmin() || profile.getUser().getId().equals(user.userId())) {
            return;
        }
        boolean allowed = donationRepository.findByDonorIdOrderByDonatedAtDesc(profile.getId()).stream()
                .anyMatch(donation -> user.belongsTo(donation.getOrganization().getId())
                        && user.hasPermissionForOrganization(permission, donation.getOrganization().getId()));
        if (!allowed) {
            throw new TenantAccessDeniedException(profile.getId());
        }
    }

    private DonorProfile find(Long id) {
        return donorRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("DonorProfile", id));
    }
}
