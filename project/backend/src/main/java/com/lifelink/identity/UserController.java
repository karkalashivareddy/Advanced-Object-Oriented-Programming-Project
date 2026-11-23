package com.lifelink.identity;

import com.lifelink.common.ApiResponse;
import com.lifelink.common.PageResponse;
import com.lifelink.identity.dto.AuthDtos.UserView;
import org.springframework.data.domain.Pageable;
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
    private final UserService service;

    public UserController(UserService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PageResponse<UserView>> list(@RequestParam(required = false) String search,
                                                    Pageable pageable) {
        return ApiResponse.ok(service.list(search, pageable));
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<UserView> changeStatus(@PathVariable Long id, @RequestBody StatusRequest request) {
        return ApiResponse.ok(service.changeStatus(id, request.status()), "Status updated");
    }

    public record StatusRequest(User.Status status) {
    }
}
