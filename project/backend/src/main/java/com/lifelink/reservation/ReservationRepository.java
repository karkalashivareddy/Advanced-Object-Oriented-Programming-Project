package com.lifelink.reservation;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    Optional<Reservation> findByIdempotencyKey(String idempotencyKey);

    @Query("select r from Reservation r where r.status = com.lifelink.reservation.Reservation$Status.ACTIVE and r.expiresAt < :now")
    List<Reservation> findExpired(@Param("now") Instant now);

    List<Reservation> findByRequestId(Long requestId);
    long countByStatus(Reservation.Status status);
    long countByOrganizationIdAndStatus(Long organizationId, Reservation.Status status);
}
