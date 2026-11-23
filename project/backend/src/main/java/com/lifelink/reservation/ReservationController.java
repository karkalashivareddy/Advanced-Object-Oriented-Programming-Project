package com.lifelink.reservation;

import com.lifelink.common.ApiResponse;
import com.lifelink.reservation.dto.ReservationDtos.CreateRequest;
import com.lifelink.reservation.dto.ReservationDtos.View;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reservations")
public class ReservationController {
    private final ReservationService service;

    public ReservationController(ReservationService service) {
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
    public ApiResponse<View> create(@Valid @RequestBody CreateRequest request) {
        return ApiResponse.ok(service.create(request), "Unit reserved");
    }

    @PostMapping("/{id}/confirm")
    public ApiResponse<View> confirm(@PathVariable Long id) {
        return ApiResponse.ok(service.confirm(id), "Reservation confirmed");
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<View> cancel(@PathVariable Long id) {
        return ApiResponse.ok(service.cancel(id), "Reservation cancelled");
    }
}
