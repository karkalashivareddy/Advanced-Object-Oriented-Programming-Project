package com.lifelink.donor;

import com.lifelink.common.ApiResponse;
import com.lifelink.donor.dto.DonationDtos.ApprovalRequest;
import com.lifelink.donor.dto.DonationDtos.CreateRequest;
import com.lifelink.donor.dto.DonationDtos.RejectRequest;
import com.lifelink.donor.dto.DonationDtos.ScreeningRequest;
import com.lifelink.donor.dto.DonationDtos.View;
import com.lifelink.inventory.dto.InventoryDtos;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/donations")
public class DonationController {
    private final DonationService service;

    public DonationController(DonationService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<View>> list(@RequestParam(required = false) Long donorId,
                                        @RequestParam(required = false) Long organizationId) {
        return ApiResponse.ok(service.list(donorId, organizationId));
    }

    @GetMapping("/{id}")
    public ApiResponse<View> get(@PathVariable Long id) {
        return ApiResponse.ok(service.get(id));
    }

    @PostMapping
    public ApiResponse<View> record(@Valid @RequestBody CreateRequest request) {
        return ApiResponse.ok(service.record(request), "Donation recorded");
    }

    @PostMapping("/{id}/screen")
    public ApiResponse<View> screen(@PathVariable Long id, @Valid @RequestBody ScreeningRequest request) {
        return ApiResponse.ok(service.screen(id, request), "Screening recorded");
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<View> approve(@PathVariable Long id, @Valid @RequestBody ApprovalRequest request) {
        return ApiResponse.ok(service.approve(id, request), "Donation approved; units are quarantined pending release");
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<View> reject(@PathVariable Long id, @Valid @RequestBody RejectRequest request) {
        return ApiResponse.ok(service.reject(id, request), "Donation rejected");
    }

    @GetMapping("/{id}/units")
    public ApiResponse<List<InventoryDtos.View>> units(@PathVariable Long id) {
        return ApiResponse.ok(service.units(id));
    }
}
