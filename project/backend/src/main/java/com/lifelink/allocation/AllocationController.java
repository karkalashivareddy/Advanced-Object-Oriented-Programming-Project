package com.lifelink.allocation;

import com.lifelink.common.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/allocations")
public class AllocationController {
    private final AllocationService service;

    public AllocationController(AllocationService service) {
        this.service = service;
    }

    @PostMapping("/suggestions")
    public ApiResponse<AllocationService.Suggestion> suggestions(@Valid @RequestBody RequestRequest request) {
        return ApiResponse.ok(service.suggest(request.requestId()));
    }

    @PostMapping("/confirm")
    public ApiResponse<AllocationService.Confirmation> confirm(
            @Valid @RequestBody ConfirmRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyHeader) {
        String key = idempotencyHeader != null && !idempotencyHeader.isBlank()
                ? idempotencyHeader : request.idempotencyKey();
        return ApiResponse.ok(service.confirm(request.requestId(), request.unitIds(), key),
                "Allocation confirmed; reservations created");
    }

    public record RequestRequest(Long requestId) {
    }

    public record ConfirmRequest(Long requestId, List<Long> unitIds, String idempotencyKey) {
    }
}
