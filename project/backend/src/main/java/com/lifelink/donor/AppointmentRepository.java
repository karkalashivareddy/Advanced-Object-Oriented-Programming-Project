package com.lifelink.donor;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {
    java.util.List<Appointment> findByDonorIdOrderByScheduledAtDesc(Long donorId);
    java.util.List<Appointment> findByOrganizationIdOrderByScheduledAtDesc(Long organizationId);
    boolean existsByDonorIdAndOrganizationId(Long donorId, Long organizationId);
}
