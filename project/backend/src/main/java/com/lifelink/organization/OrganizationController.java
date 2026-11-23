package com.lifelink.organization;

import com.lifelink.common.ApiResponse;
import com.lifelink.common.PageResponse;
import com.lifelink.identity.Role;
import com.lifelink.identity.dto.AuthDtos.UserView;
import com.lifelink.organization.dto.OrganizationDtos.CreateRequest;
import com.lifelink.organization.dto.OrganizationDtos.UpdateRequest;
import com.lifelink.organization.dto.OrganizationDtos.View;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizations")
public class OrganizationController {
    private static final int MAX_PAGE_SIZE = 100;

    private final OrganizationService service;

    public OrganizationController(OrganizationService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PageResponse<View>> list(@PageableDefault(size = 20) Pageable pageable) {
        Page<View> page = service.list(capPageSize(pageable));
        return ApiResponse.ok(PageResponse.from(page, view -> view));
    }

    @GetMapping("/{id}")
    public ApiResponse<View> get(@PathVariable("id") Long id) {
        return ApiResponse.ok(service.get(id));
    }

    @PostMapping
    public ApiResponse<View> create(@Valid @RequestBody CreateRequest request) {
        return ApiResponse.ok(service.create(request), "Organization created");
    }

    @PatchMapping("/{id}")
    public ApiResponse<View> update(@PathVariable("id") Long id, @Valid @RequestBody UpdateRequest request) {
        return ApiResponse.ok(service.update(id, request), "Organization updated");
    }

    @PostMapping("/{id}/verify")
    public ApiResponse<View> verify(@PathVariable("id") Long id) {
        return ApiResponse.ok(service.verify(id), "Organization verified");
    }

    @GetMapping("/{id}/members")
    public ApiResponse<java.util.List<UserView>> members(@PathVariable("id") Long id) {
        return ApiResponse.ok(service.members(id));
    }

    @PostMapping("/{id}/members")
    public ApiResponse<Void> addMember(@PathVariable("id") Long id,
                                       @Valid @RequestBody MemberRequest request) {
        service.addMember(id, request.userId(), request.role());
        return ApiResponse.ok(null, "Member added");
    }

    private Pageable capPageSize(Pageable pageable) {
        return pageable.getPageSize() <= MAX_PAGE_SIZE ? pageable
                : PageRequest.of(pageable.getPageNumber(), MAX_PAGE_SIZE, pageable.getSort());
    }

    public record MemberRequest(@NotNull Long userId, @NotNull Role role) {
    }
}
