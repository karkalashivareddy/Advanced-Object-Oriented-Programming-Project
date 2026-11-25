package com.lifelink.donor;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DonorProfileRepository extends JpaRepository<DonorProfile, Long> {
    Optional<DonorProfile> findByUserId(Long userId);

    @Query(value = """
            select dp from DonorProfile dp
            where (dp.user.id = :userId or exists (
                    select d.id from Donation d where d.donor = dp and d.organization.id in :organizationIds
                ))
              and (:bloodGroup is null or dp.bloodGroup = :bloodGroup)
              and (:availability is null or dp.availability = :availability)
              and (:city is null or lower(dp.city) like lower(concat('%', :city, '%')))
              and (:state is null or lower(dp.state) like lower(concat('%', :state, '%')))
              and (:search is null or lower(dp.publicId) like lower(concat('%', :search, '%'))
                   or lower(dp.user.fullName) like lower(concat('%', :search, '%')))
            """,
            countQuery = """
            select count(dp) from DonorProfile dp
            where (dp.user.id = :userId or exists (
                    select d.id from Donation d where d.donor = dp and d.organization.id in :organizationIds
                ))
              and (:bloodGroup is null or dp.bloodGroup = :bloodGroup)
              and (:availability is null or dp.availability = :availability)
              and (:city is null or lower(dp.city) like lower(concat('%', :city, '%')))
              and (:state is null or lower(dp.state) like lower(concat('%', :state, '%')))
              and (:search is null or lower(dp.publicId) like lower(concat('%', :search, '%'))
                   or lower(dp.user.fullName) like lower(concat('%', :search, '%')))
            """)
    Page<DonorProfile> findVisibleToUser(@Param("userId") Long userId,
                                         @Param("organizationIds") java.util.Collection<Long> organizationIds,
                                         @Param("bloodGroup") com.lifelink.common.BloodGroup bloodGroup,
                                         @Param("availability") DonorProfile.Availability availability,
                                         @Param("city") String city,
                                         @Param("state") String state,
                                         @Param("search") String search,
                                         Pageable pageable);

    @Query("""
            select dp from DonorProfile dp
            where (:bloodGroup is null or dp.bloodGroup = :bloodGroup)
              and (:availability is null or dp.availability = :availability)
              and (:city is null or lower(dp.city) like lower(concat('%', :city, '%')))
              and (:state is null or lower(dp.state) like lower(concat('%', :state, '%')))
              and (:search is null or lower(dp.publicId) like lower(concat('%', :search, '%'))
                   or lower(dp.user.fullName) like lower(concat('%', :search, '%')))
            """)
    Page<DonorProfile> searchAll(@Param("bloodGroup") com.lifelink.common.BloodGroup bloodGroup,
                                 @Param("availability") DonorProfile.Availability availability,
                                 @Param("city") String city,
                                 @Param("state") String state,
                                 @Param("search") String search,
                                 Pageable pageable);

    @Query("""
            select dp from DonorProfile dp
            where dp.user.id = :userId
              and (:bloodGroup is null or dp.bloodGroup = :bloodGroup)
              and (:availability is null or dp.availability = :availability)
              and (:city is null or lower(dp.city) like lower(concat('%', :city, '%')))
              and (:state is null or lower(dp.state) like lower(concat('%', :state, '%')))
              and (:search is null or lower(dp.publicId) like lower(concat('%', :search, '%'))
                   or lower(dp.user.fullName) like lower(concat('%', :search, '%')))
            """)
    Page<DonorProfile> searchOwned(@Param("userId") Long userId,
                                   @Param("bloodGroup") com.lifelink.common.BloodGroup bloodGroup,
                                   @Param("availability") DonorProfile.Availability availability,
                                   @Param("city") String city,
                                   @Param("state") String state,
                                   @Param("search") String search,
                                   Pageable pageable);

    /**
     * Returns only opted-in available donors within the bounding box and exact radius.
     * Pageable is a hard result cap; this never loads the full donor table into Java.
     */
    @Query(value = """
            SELECT dp.* FROM donor_profiles dp
            WHERE dp.blood_group = :bloodGroup
              AND dp.availability = 'AVAILABLE'
              AND dp.latitude BETWEEN :minLatitude AND :maxLatitude
              AND dp.longitude BETWEEN :minLongitude AND :maxLongitude
              AND EXISTS (
                  SELECT 1 FROM consents c
                  WHERE c.donor_id = dp.id AND c.type = 'LOCATION_DISCOVERY'
                    AND c.granted = TRUE AND c.withdrawn_at IS NULL
              )
              AND dp.location_updated_at >= :freshAfter
              AND 2 * 6371.0088 * ASIN(SQRT(LEAST(1.0, GREATEST(0.0,
                    POWER(SIN(RADIANS(dp.latitude - :originLatitude) / 2.0), 2)
                    + COS(RADIANS(:originLatitude)) * COS(RADIANS(dp.latitude))
                      * POWER(SIN(RADIANS(dp.longitude - :originLongitude) / 2.0), 2)
              )))) <= :radiusKm
            ORDER BY 2 * 6371.0088 * ASIN(SQRT(LEAST(1.0, GREATEST(0.0,
                    POWER(SIN(RADIANS(dp.latitude - :originLatitude) / 2.0), 2)
                    + COS(RADIANS(:originLatitude)) * COS(RADIANS(dp.latitude))
                      * POWER(SIN(RADIANS(dp.longitude - :originLongitude) / 2.0), 2)
              )))) ASC, dp.id ASC
            """, nativeQuery = true)
    java.util.List<DonorProfile> findNearbyOptedIn(
            @Param("bloodGroup") String bloodGroup,
            @Param("originLatitude") double originLatitude,
            @Param("originLongitude") double originLongitude,
            @Param("minLatitude") double minLatitude,
            @Param("maxLatitude") double maxLatitude,
            @Param("minLongitude") double minLongitude,
            @Param("maxLongitude") double maxLongitude,
            @Param("radiusKm") double radiusKm,
            @Param("freshAfter") java.time.Instant freshAfter,
            Pageable pageable);
}
