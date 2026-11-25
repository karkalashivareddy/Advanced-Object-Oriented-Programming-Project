-- Additive geo discovery schema. Compatible with H2 (PostgreSQL mode) and PostgreSQL 16.
-- Latitude/longitude/freshness are nullable and must be populated together so that a
-- donor with no location consent simply does not participate in proximity queries.

ALTER TABLE donor_profiles ADD COLUMN latitude DOUBLE PRECISION;
ALTER TABLE donor_profiles ADD COLUMN longitude DOUBLE PRECISION;
ALTER TABLE donor_profiles ADD COLUMN location_updated_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE organizations ADD COLUMN latitude DOUBLE PRECISION;
ALTER TABLE organizations ADD COLUMN longitude DOUBLE PRECISION;
ALTER TABLE organizations ADD COLUMN location_updated_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE donor_profiles ADD CONSTRAINT chk_donor_location_all_or_none CHECK (
    (latitude IS NULL AND longitude IS NULL AND location_updated_at IS NULL)
    OR (
        latitude IS NOT NULL AND longitude IS NOT NULL AND location_updated_at IS NOT NULL
        AND latitude >= -90 AND latitude <= 90
        AND longitude >= -180 AND longitude <= 180
    )
);

ALTER TABLE organizations ADD CONSTRAINT chk_organization_location_all_or_none CHECK (
    (latitude IS NULL AND longitude IS NULL AND location_updated_at IS NULL)
    OR (
        latitude IS NOT NULL AND longitude IS NOT NULL AND location_updated_at IS NOT NULL
        AND latitude >= -90 AND latitude <= 90
        AND longitude >= -180 AND longitude <= 180
    )
);

-- Prefilter index: availability + bounding-box columns are all evaluated in SQL before
-- exact Haversine distances are calculated in Java.
CREATE INDEX idx_donor_geo_availability ON donor_profiles(availability, latitude, longitude);
CREATE INDEX idx_donor_geo_search ON donor_profiles(blood_group, availability, latitude, longitude, location_updated_at);

-- Covers the active-consent predicate used by every nearby search. Names match V2's
-- consents(donor_id, type, granted, withdrawn_at) schema exactly.
CREATE INDEX idx_consent_geo_lookup ON consents(donor_id, type, granted, withdrawn_at);
