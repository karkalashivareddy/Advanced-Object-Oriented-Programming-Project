package com.lifelink.identity;

import com.lifelink.common.ApiResponse;
import com.lifelink.common.PageResponse;
import com.lifelink.identity.dto.AuthDtos.UserView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    private static final int MAX_PAGE_SIZE = 100;

    private final UserService service;

    public UserController(UserService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PageResponse<UserView>> list(@RequestParam(required = false) String search,
                                                     @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.ok(service.list(search, capPageSize(pageable)));
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<UserView> changeStatus(@PathVariable("id") Long id,
                                              @Valid @RequestBody StatusRequest request) {
        return ApiResponse.ok(service.changeStatus(id, request.status()), "Status updated");
    }

    private Pageable capPageSize(Pageable pageable) {
        return pageable.getPageSize() <= MAX_PAGE_SIZE ? pageable
                : PageRequest.of(pageable.getPageNumber(), MAX_PAGE_SIZE, pageable.getSort());
    }

    public record StatusRequest(@NotNull User.Status status) {
    }
}
