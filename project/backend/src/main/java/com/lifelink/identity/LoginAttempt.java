package com.lifelink.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "login_attempts")
public class LoginAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 190)
    private String email;

    @Column(name = "failed_count", nullable = false)
    private int failedCount;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    protected LoginAttempt() {
    }

    public LoginAttempt(String email) {
        this.email = email.toLowerCase();
    }

    public void registerFailure(Instant now, int threshold, java.time.Duration lockDuration) {
        failedCount++;
        if (failedCount >= threshold) {
            lockedUntil = now.plus(lockDuration);
            failedCount = 0;
        }
    }

    public void clear() {
        failedCount = 0;
        lockedUntil = null;
    }

    public boolean isLocked(Instant now) {
        return lockedUntil != null && lockedUntil.isAfter(now);
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public int getFailedCount() { return failedCount; }
    public Instant getLockedUntil() { return lockedUntil; }
}
