package com.lifelink.dispatch;

import com.lifelink.common.ApiResponse;
import com.lifelink.dispatch.dto.DispatchDtos.CreateRequest;
import com.lifelink.dispatch.dto.DispatchDtos.DeliveryRequest;
import com.lifelink.dispatch.dto.DispatchDtos.IncidentRequest;
import com.lifelink.dispatch.dto.DispatchDtos.View;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dispatches")
public class DispatchController {
    private final DispatchService service;

    public DispatchController(DispatchService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<View>> list() {
        return ApiResponse.ok(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<View> get(@PathVariable Long id) {
        return ApiResponse.ok(service.get(id));
    }

    @PostMapping
    public ApiResponse<View> create(@Valid @RequestBody CreateRequest request,
                                    @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return ApiResponse.ok(service.create(request), "Dispatch created");
    }

    @PostMapping("/{id}/depart")
    public ApiResponse<View> depart(@PathVariable Long id) {
        return ApiResponse.ok(service.depart(id), "Dispatch marked in transit");
    }

    @PostMapping("/{id}/deliver")
    public ApiResponse<View> deliver(@PathVariable Long id, @Valid @RequestBody DeliveryRequest request) {
        return ApiResponse.ok(service.deliver(id, request), "Delivery confirmed");
    }

    @PostMapping("/{id}/incident")
    public ApiResponse<View> incident(@PathVariable Long id, @Valid @RequestBody IncidentRequest request) {
        return ApiResponse.ok(service.incident(id, request), "Incident recorded");
    }
}
