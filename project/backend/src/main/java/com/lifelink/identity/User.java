package com.lifelink.identity;

import com.lifelink.common.BaseEntity;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.util.EnumSet;
import java.util.Set;

@Entity
@Table(name = "users")
public class User extends BaseEntity {

    public enum Status { ACTIVE, PENDING_VERIFICATION, LOCKED, DISABLED }

    @Column(nullable = false, unique = true, length = 190)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(nullable = false, length = 160)
    private String fullName;

    @Column(length = 32)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status = Status.ACTIVE;

    /** Monotonic revocation marker embedded in access tokens; never derived from mutable state. */
    @Column(name = "token_version", nullable = false)
    private long tokenVersion = 0L;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 32)
    private Set<Role> roles = EnumSet.noneOf(Role.class);

    protected User() {
    }

    public User(String email, String passwordHash, String fullName, String phone, Status status, Set<Role> roles) {
        setEmail(email);
        setPasswordHash(passwordHash);
        setFullName(fullName);
        this.phone = phone;
        this.status = status == null ? Status.ACTIVE : status;
        assignRoles(roles);
    }

    public void assignRoles(Set<Role> newRoles) {
        if (newRoles == null || newRoles.isEmpty()) {
            throw new IllegalArgumentException("At least one role is required");
        }
        this.roles = EnumSet.copyOf(newRoles);
    }

    public void changePassword(String newHash) {
        setPasswordHash(newHash);
        invalidateTokens();
    }

    public void lock() { setStatus(Status.LOCKED); }
    public void activate() { setStatus(Status.ACTIVE); }
    public void disable() { setStatus(Status.DISABLED); }
    public void markPendingVerification() { setStatus(Status.PENDING_VERIFICATION); }

    private void setStatus(Status next) {
        Status target = next == null ? Status.ACTIVE : next;
        if (this.status != target) {
            this.status = target;
            invalidateTokens();
        }
    }

    /** Called once for every credential or status transition so old JWTs stay rejected. */
    public void invalidateTokens() {
        this.tokenVersion++;
    }

    public Set<Permission> effectivePermissions() {
        Set<Permission> result = EnumSet.noneOf(Permission.class);
        roles.forEach(role -> result.addAll(role.permissions()));
        return Set.copyOf(result);
    }

    private void setEmail(String value) {
        if (value == null || !value.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new IllegalArgumentException("A valid email is required");
        }
        this.email = value.trim().toLowerCase();
    }

    private void setPasswordHash(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Password hash is required");
        }
        this.passwordHash = value;
    }

    private void setFullName(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Full name is required");
        }
        this.fullName = value.trim();
    }

    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getFullName() { return fullName; }
    public String getPhone() { return phone; }
    public Status getStatus() { return status; }
    public long getTokenVersion() { return tokenVersion; }
    public Set<Role> getRoles() { return Set.copyOf(roles); }
}
