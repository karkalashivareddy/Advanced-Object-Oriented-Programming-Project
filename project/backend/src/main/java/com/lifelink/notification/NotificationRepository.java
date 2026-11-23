package com.lifelink.notification;

import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    long countByUserIdAndReadAtIsNull(Long userId);
    org.springframework.data.domain.Page<Notification> findAllByUserIdOrderByCreatedAtDesc(
            Long userId, org.springframework.data.domain.Pageable pageable);
    java.util.Optional<Notification> findByPublicId(String publicId);
}
