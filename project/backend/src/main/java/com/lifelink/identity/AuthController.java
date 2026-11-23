package com.lifelink.identity;

import com.lifelink.common.ApiResponse;
import com.lifelink.identity.dto.AuthDtos.AuthResponse;
import com.lifelink.identity.dto.AuthDtos.ChangePasswordRequest;
import com.lifelink.identity.dto.AuthDtos.LoginRequest;
import com.lifelink.identity.dto.AuthDtos.LogoutRequest;
import com.lifelink.identity.dto.AuthDtos.RefreshRequest;
import com.lifelink.identity.dto.AuthDtos.RegisterRequest;
import com.lifelink.identity.dto.AuthDtos.UserView;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService authService;
    private final TenantAccessService tenantAccessService;

    public AuthController(AuthService authService, TenantAccessService tenantAccessService) {
        this.authService = authService;
        this.tenantAccessService = tenantAccessService;
    }

    @PostMapping("/register")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.ok(authService.register(request), "Account created");
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request), "Signed in");
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ApiResponse.ok(authService.refresh(request));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestBody(required = false) LogoutRequest request) {
        authService.logout(request == null ? null : request.refreshToken());
        return ApiResponse.ok(null, "Signed out");
    }

    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(tenantAccessService.currentUser().userId(), request);
        return ApiResponse.ok(null, "Password changed; all sessions were revoked");
    }

    @GetMapping("/me")
    public ApiResponse<UserView> me() {
        return ApiResponse.ok(authService.me(tenantAccessService.currentUser().userId()));
    }
}
