package com.lifelink.identity;

import java.util.Collection;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public record AuthenticatedUser(
        Long userId,
        String email,
        String fullName,
        Set<Role> roles,
        Set<Permission> permissions,
        Set<Long> organizationIds,
        Set<OrganizationRole> memberships) implements UserDetails {

    public record OrganizationRole(Long organizationId, String organizationName, Role role) {
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        Set<String> authorities = permissions.stream().map(Permission::name).collect(Collectors.toSet());
        roles.stream().map(role -> "ROLE_" + role.name()).forEach(authorities::add);
        return authorities.stream().map(SimpleGrantedAuthority::new).toList();
    }

    @Override
    public String getPassword() {
        return "";
    }

    @Override
    public String getUsername() {
        return email;
    }

    public boolean hasPermission(Permission permission) {
        return permissions.contains(permission);
    }

    public boolean isPlatformAdmin() {
        return roles.contains(Role.PLATFORM_ADMIN);
    }

    public boolean belongsTo(Long organizationId) {
        return organizationId != null && (organizationIds.contains(organizationId) || isPlatformAdmin());
    }

    public boolean hasOrganizationRole(Long organizationId, Role role) {
        return memberships.stream()
                .anyMatch(m -> Objects.equals(m.organizationId(), organizationId) && m.role() == role);
    }
}
