package com.lifelink.identity;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, Long> {
    Optional<LoginAttempt> findByEmail(String email);

    /** Pessimistic write lock so concurrent failures for one email are serialized. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from LoginAttempt a where a.email = :email")
    Optional<LoginAttempt> findByEmailForUpdate(@Param("email") String email);
}
