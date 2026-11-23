package com.lifelink.inventory;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StorageLocationRepository extends JpaRepository<StorageLocation, Long> {
    List<StorageLocation> findByOrganizationId(Long organizationId);
}
