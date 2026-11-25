package com.lifelink.common;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;

/**
 * Immutable WGS84 point used only for coarse proximity discovery.
 *
 * <p>Invariants: both coordinates are finite and within [-90, 90] / [-180, 180].
 * Exact coordinates never leave the backend: every public projection is reduced to a
 * coarse grid cell. Failure outcome: construction rejects invalid values with
 * {@link IllegalArgumentException}; bounding-box and cell helpers reject invalid radii.</p>
 */
public record GeoPoint(double latitude, double longitude) {

    /** Mean Earth radius in kilometres; Haversine results are estimates, not survey data. */
    public static final double EARTH_RADIUS_KM = 6371.0088;
    public static final double GRID_DEGREES = 0.02;

    private static final BigDecimal CELL = new BigDecimal("0.02");
    private static final BigDecimal HALF_CELL = new BigDecimal("0.01");
    private static final double FULL_LONGITUDE_SPAN = 180.0;

    public GeoPoint {
        if (!Double.isFinite(latitude) || !Double.isFinite(longitude)) {
            throw new IllegalArgumentException("Coordinates must be finite");
        }
        if (latitude < -90.0 || latitude > 90.0) {
            throw new IllegalArgumentException("Latitude must be within [-90, 90]");
        }
        if (longitude < -180.0 || longitude > 180.0) {
            throw new IllegalArgumentException("Longitude must be within [-180, 180]");
        }
    }

    /** Great-circle distance in kilometres. Preconditions: this point and {@code other} are valid. */
    public double distanceKmTo(GeoPoint other) {
        if (other == null) {
            throw new IllegalArgumentException("A target point is required");
        }
        double dLat = Math.toRadians(other.latitude - latitude);
        double dLon = Math.toRadians(other.longitude - longitude);
        double a = Math.pow(Math.sin(dLat / 2.0), 2.0)
                + Math.cos(Math.toRadians(latitude)) * Math.cos(Math.toRadians(other.latitude))
                * Math.pow(Math.sin(dLon / 2.0), 2.0);
        double clamped = Math.min(1.0, Math.max(0.0, a));
        return 2.0 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(clamped), Math.sqrt(1.0 - clamped));
    }

    /**
     * Conservative latitude/longitude prefilter for a radius query.
     *
     * <p>Poles fall back to the full longitude range. Dateline crossings are clamped to
     * the full valid longitude range rather than emitting a wrapped interval, which an
     * ordinary SQL {@code BETWEEN} cannot express. The box therefore never excludes a
     * point that could be inside the radius; exact filtering happens in Java.</p>
     */
    public BoundingBox boundingBox(double radiusKm) {
        if (!Double.isFinite(radiusKm) || radiusKm <= 0.0) {
            throw new IllegalArgumentException("Radius must be finite and positive");
        }
        double angularDistance = radiusKm / EARTH_RADIUS_KM;
        double latDelta = Math.toDegrees(angularDistance);
        double minLat = Math.max(-90.0, latitude - latDelta);
        double maxLat = Math.min(90.0, latitude + latDelta);
        double cosLat = Math.cos(Math.toRadians(latitude));
        double lonDelta;
        if (Math.abs(cosLat) < 1e-9 || latDelta >= 90.0 - Math.abs(latitude)) {
            lonDelta = FULL_LONGITUDE_SPAN;
        } else {
            double ratio = Math.sin(angularDistance) / cosLat;
            lonDelta = Math.abs(ratio) >= 1.0
                    ? FULL_LONGITUDE_SPAN : Math.toDegrees(Math.asin(ratio));
        }
        double minLon = longitude - lonDelta;
        double maxLon = longitude + lonDelta;
        if (lonDelta >= FULL_LONGITUDE_SPAN || minLon < -180.0 || maxLon > 180.0) {
            return new BoundingBox(minLat, maxLat, -180.0, 180.0);
        }
        return new BoundingBox(minLat, maxLat, minLon, maxLon);
    }

    /**
     * Deterministic 0.02-degree grid cell centre. Uses decimal arithmetic so points on a
     * cell edge do not flip between float representations. Postcondition: returned centre
     * is finite and inside the same valid coordinate range as its source coordinate.
     */
    public GeoCell coarseCell() {
        return new GeoCell(cellCentre(latitude, -90.0, 90.0), cellCentre(longitude, -180.0, 180.0));
    }

    private static double cellCentre(double coordinate, double min, double max) {
        BigDecimal index = BigDecimal.valueOf(coordinate).divide(CELL, 0, RoundingMode.FLOOR);
        BigDecimal centre = index.multiply(CELL).add(HALF_CELL);
        BigDecimal lower = BigDecimal.valueOf(min);
        BigDecimal upper = BigDecimal.valueOf(max);
        if (centre.compareTo(lower) < 0) {
            centre = lower;
        } else if (centre.compareTo(upper) > 0) {
            centre = upper;
        }
        return centre.setScale(6, RoundingMode.HALF_UP).doubleValue();
    }

    /** Inclusive SQL-ready bounding box; longitude may span the full valid range. */
    public record BoundingBox(double minLatitude, double maxLatitude,
                              double minLongitude, double maxLongitude) {
    }

    /** Coarse cell centre, safe to log or audit; never an exact location. */
    public record GeoCell(double latitude, double longitude) {
        public String format() {
            return String.format(Locale.ROOT, "%.6f,%.6f", latitude, longitude);
        }
    }
}
