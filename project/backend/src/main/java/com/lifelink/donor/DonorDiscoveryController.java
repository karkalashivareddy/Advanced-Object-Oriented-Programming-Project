package com.lifelink.donor;

import com.lifelink.common.ApiResponse;
import com.lifelink.common.BloodGroup;
import com.lifelink.donor.dto.NearbyDonorSearchResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/donors")
public class DonorDiscoveryController {
    private final DonorDiscoveryService service;

    public DonorDiscoveryController(DonorDiscoveryService service) {
        this.service = service;
    }

    @GetMapping("/nearby")
    public ApiResponse<NearbyDonorSearchResponse> nearby(
            @RequestParam BloodGroup bloodGroup,
            @RequestParam double latitude,
            @RequestParam double longitude,
            @RequestParam double radiusKm) {
        return ApiResponse.ok(service.search(bloodGroup, latitude, longitude, radiusKm));
    }
}
