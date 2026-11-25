package com.lifelink.donor;

import com.lifelink.common.ApiResponse;
import com.lifelink.common.PageResponse;
import com.lifelink.common.BloodGroup;
import com.lifelink.donor.dto.DonorDtos.AppointmentActionRequest;
import com.lifelink.donor.dto.DonorDtos.AppointmentRequest;
import com.lifelink.donor.dto.DonorDtos.AppointmentView;
import com.lifelink.donor.dto.DonorDtos.ConsentRequest;
import com.lifelink.donor.dto.DonorDtos.ConsentView;
import com.lifelink.donor.dto.DonorDtos.CreateProfileRequest;
import com.lifelink.donor.dto.DonorDtos.ProfileView;
import com.lifelink.donor.dto.DonorDtos.UpdateProfileRequest;
import com.lifelink.donor.dto.DonorDtos.LocationPreferenceRequest;
import com.lifelink.donor.dto.DonorDtos.LocationPreferenceView;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/donors")
public class DonorController {
    private static final int MAX_PAGE_SIZE = 100;
    private final DonorService service;

    public DonorController(DonorService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PageResponse<ProfileView>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) BloodGroup bloodGroup,
            @RequestParam(required = false) DonorProfile.Availability availability,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String state,
            @PageableDefault(size = 20) Pageable pageable) {
        Pageable bounded = PageRequest.of(pageable.getPageNumber(),
                Math.max(1, Math.min(pageable.getPageSize(), MAX_PAGE_SIZE)),
                Sort.by(Sort.Direction.ASC, "id"));
        return ApiResponse.ok(service.list(search, bloodGroup, availability, city, state, bounded));
    }

    @GetMapping("/{id}")
    public ApiResponse<ProfileView> get(@PathVariable Long id) {
        return ApiResponse.ok(service.get(id));
    }

    @PostMapping
    public ApiResponse<ProfileView> create(@Valid @RequestBody CreateProfileRequest request) {
        return ApiResponse.ok(service.create(request), "Donor profile created");
    }

    @PatchMapping("/{id}")
    public ApiResponse<ProfileView> update(@PathVariable Long id, @Valid @RequestBody UpdateProfileRequest request) {
        return ApiResponse.ok(service.update(id, request), "Donor profile updated");
    }

    @PatchMapping("/{id}/location-preference")
    public ApiResponse<LocationPreferenceView> updateLocationPreference(
            @PathVariable Long id, @Valid @RequestBody LocationPreferenceRequest request) {
        return ApiResponse.ok(service.updateLocationPreference(id, request), "Location preference updated");
    }

    @GetMapping("/{id}/consents")
    public ApiResponse<List<ConsentView>> consents(@PathVariable Long id) {
        return ApiResponse.ok(service.consents(id));
    }

    @PostMapping("/{id}/consents")
    public ApiResponse<ConsentView> addConsent(@PathVariable Long id, @Valid @RequestBody ConsentRequest request) {
        return ApiResponse.ok(service.addConsent(id, request), "Consent recorded");
    }

    @PatchMapping("/{id}/consents/{consentId}")
    public ApiResponse<Void> withdrawConsent(@PathVariable Long id, @PathVariable Long consentId) {
        service.withdrawConsent(id, consentId);
        return ApiResponse.ok(null, "Consent withdrawn");
    }

    @GetMapping("/{id}/appointments")
    public ApiResponse<List<AppointmentView>> appointments(@PathVariable Long id) {
        return ApiResponse.ok(service.appointments(id));
    }

    @PostMapping("/{id}/appointments")
    public ApiResponse<AppointmentView> requestAppointment(@PathVariable Long id,
                                                           @Valid @RequestBody AppointmentRequest request) {
        return ApiResponse.ok(service.requestAppointment(id, request), "Appointment requested");
    }

    @PatchMapping("/appointments/{appointmentId}")
    public ApiResponse<AppointmentView> appointmentAction(@PathVariable Long appointmentId,
                                                          @Valid @RequestBody AppointmentActionRequest request) {
        return ApiResponse.ok(service.actionAppointment(appointmentId, request), "Appointment updated");
    }
}
