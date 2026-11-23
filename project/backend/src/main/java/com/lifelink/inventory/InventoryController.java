package com.lifelink.inventory;

import com.lifelink.common.ApiResponse;
import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.common.PageResponse;
import com.lifelink.inventory.dto.InventoryDtos.AdjustmentRequest;
import com.lifelink.inventory.dto.InventoryDtos.Alerts;
import com.lifelink.inventory.dto.InventoryDtos.CreateRequest;
import com.lifelink.inventory.dto.InventoryDtos.MovementView;
import com.lifelink.inventory.dto.InventoryDtos.View;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/inventory")
public class InventoryController {
    private final InventoryService service;

    public InventoryController(InventoryService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PageResponse<View>> search(
            @RequestParam(required = false) Long organizationId,
            @RequestParam(required = false) BloodGroup bloodGroup,
            @RequestParam(required = false) ComponentType componentType,
            @RequestParam(required = false) BloodUnit.Status status,
            @RequestParam(required = false) Integer expiringWithinDays,
            Pageable pageable) {
        return ApiResponse.ok(service.search(organizationId, bloodGroup, componentType, status,
                expiringWithinDays, pageable));
    }

    @GetMapping("/alerts")
    public ApiResponse<Alerts> alerts() {
        return ApiResponse.ok(service.alerts());
    }

    @GetMapping("/{id}")
    public ApiResponse<View> get(@PathVariable Long id) {
        return ApiResponse.ok(service.get(id));
    }

    @PostMapping
    public ApiResponse<View> create(@Valid @RequestBody CreateRequest request) {
        return ApiResponse.ok(service.create(request), "Blood unit created");
    }

    @PostMapping("/{id}/release")
    public ApiResponse<View> release(@PathVariable Long id) {
        return ApiResponse.ok(service.release(id), "Unit released");
    }

    @PostMapping("/{id}/expire")
    public ApiResponse<View> expire(@PathVariable Long id) {
        return ApiResponse.ok(service.expire(id), "Unit marked expired");
    }

    @PostMapping("/adjustments")
    public ApiResponse<View> adjust(@Valid @RequestBody AdjustmentRequest request) {
        return ApiResponse.ok(service.adjust(request), "Inventory adjusted");
    }

    @GetMapping("/{id}/movements")
    public ApiResponse<List<MovementView>> movements(@PathVariable Long id) {
        return ApiResponse.ok(service.movements(id));
    }
}
