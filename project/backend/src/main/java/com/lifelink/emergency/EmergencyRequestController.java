package com.lifelink.emergency;

import com.lifelink.common.ApiResponse;
import com.lifelink.emergency.dto.RequestDtos.CreateRequest;
import com.lifelink.emergency.dto.RequestDtos.Detail;
import com.lifelink.emergency.dto.RequestDtos.PriorityRequest;
import com.lifelink.emergency.dto.RequestDtos.ReasonRequest;
import com.lifelink.emergency.dto.RequestDtos.View;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/emergency-requests")
public class EmergencyRequestController {
    private final EmergencyRequestService service;

    public EmergencyRequestController(EmergencyRequestService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<View>> list(@RequestParam(required = false) EmergencyRequest.Status status) {
        return ApiResponse.ok(service.list(status));
    }

    @GetMapping("/{id}")
    public ApiResponse<Detail> detail(@PathVariable Long id) {
        return ApiResponse.ok(service.detail(id));
    }

    @PostMapping
    public ApiResponse<View> create(@Valid @RequestBody CreateRequest request) {
        return ApiResponse.ok(service.create(request), "Emergency request created");
    }

    @PostMapping("/{id}/verify")
    public ApiResponse<View> verify(@PathVariable Long id) {
        return ApiResponse.ok(service.verify(id), "Request verified");
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<View> approve(@PathVariable Long id) {
        return ApiResponse.ok(service.approve(id), "Request approved");
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<View> reject(@PathVariable Long id, @Valid @RequestBody ReasonRequest request) {
        return ApiResponse.ok(service.reject(id, request), "Request rejected");
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<View> cancel(@PathVariable Long id, @Valid @RequestBody ReasonRequest request) {
        return ApiResponse.ok(service.cancel(id, request), "Request cancelled");
    }

    @PatchMapping("/{id}/priority")
    public ApiResponse<View> priority(@PathVariable Long id, @Valid @RequestBody PriorityRequest request) {
        return ApiResponse.ok(service.changePriority(id, request), "Priority updated by authorized staff");
    }
}
