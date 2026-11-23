package com.lifelink.analytics;

import com.lifelink.common.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {
    private final AnalyticsService service;

    public AnalyticsController(AnalyticsService service) {
        this.service = service;
    }

    @GetMapping("/overview")
    public ApiResponse<AnalyticsService.Overview> overview() {
        return ApiResponse.ok(service.overview());
    }

    @GetMapping("/inventory")
    public ApiResponse<Map<String, Long>> inventory() {
        return ApiResponse.ok(service.inventoryByGroup());
    }

    @GetMapping("/requests")
    public ApiResponse<Map<String, Long>> requests() {
        return ApiResponse.ok(service.requestsByStatus());
    }
}
