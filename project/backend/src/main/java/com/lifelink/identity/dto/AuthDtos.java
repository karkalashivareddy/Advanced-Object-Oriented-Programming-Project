package com.lifelink.identity.dto;

import com.lifelink.identity.Role;
import com.lifelink.identity.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Set;

public final class AuthDtos {
    private AuthDtos() {
    }

    private static final String PASSWORD_PATTERN =
            "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{10,72}$";
    private static final String PASSWORD_MESSAGE =
            "Password must be 10-72 characters and include upper case, lower case, a digit and a symbol";

    public record RegisterRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 10, max = 72) @Pattern(regexp = PASSWORD_PATTERN, message = PASSWORD_MESSAGE) String password,
            @NotBlank String fullName,
            String phone) {
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    public record LogoutRequest(String refreshToken) {
    }

    public record ChangePasswordRequest(@NotBlank String currentPassword,
                                        @NotBlank @Size(min = 10, max = 72)
                                        @Pattern(regexp = PASSWORD_PATTERN, message = PASSWORD_MESSAGE) String newPassword) {
    }

    public record AuthResponse(String accessToken, String refreshToken, long expiresIn, UserView user) {
    }

    public record UserView(Long id, String publicId, String email, String fullName, String status,
                           Set<Role> roles, Set<String> permissions, Set<OrganizationMembershipView> memberships) {
        public static UserView of(User user, Set<com.lifelink.identity.Permission> permissions,
                                  Set<OrganizationMembershipView> memberships) {
            return new UserView(user.getId(), user.getPublicId(), user.getEmail(), user.getFullName(),
                    user.getStatus().name(), user.getRoles(),
                    permissions.stream().map(Enum::name).collect(java.util.stream.Collectors.toSet()),
                    memberships);
        }
    }

    public record OrganizationMembershipView(Long organizationId, String organizationName, Role role) {
    }
}
