package com.lifelink.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class GeoPointTest {
    @Test
    void validatesCoordinatesAndRejectsNonFiniteValues() {
        assertThrows(IllegalArgumentException.class, () -> new GeoPoint(Double.NaN, 0));
        assertThrows(IllegalArgumentException.class, () -> new GeoPoint(0, Double.POSITIVE_INFINITY));
        assertThrows(IllegalArgumentException.class, () -> new GeoPoint(90.01, 0));
        assertThrows(IllegalArgumentException.class, () -> new GeoPoint(0, -180.01));
    }

    @Test
    void distanceHandlesSamePointDatelineAndRadiusBoundaries() {
        GeoPoint origin = new GeoPoint(0, 179.9);
        assertEquals(0.0, origin.distanceKmTo(origin), 1e-9);
        double crossingDateline = origin.distanceKmTo(new GeoPoint(0, -179.9));
        assertTrue(crossingDateline > 20.0 && crossingDateline < 23.0);
        assertThrows(IllegalArgumentException.class, () -> origin.boundingBox(0));
        assertEquals(-180.0, origin.boundingBox(50).minLongitude());
        assertEquals(180.0, origin.boundingBox(50).maxLongitude());
    }

    @Test
    void boundingBoxIncludesPolarLongitudesAndCellRemainsInBounds() {
        GeoPoint pole = new GeoPoint(90, 0);
        assertEquals(-180.0, pole.boundingBox(5).minLongitude());
        assertEquals(180.0, pole.boundingBox(5).maxLongitude());
        assertTrue(new GeoPoint(-90, -180).coarseCell().latitude() >= -90.0);
        assertTrue(new GeoPoint(-90, -180).coarseCell().longitude() >= -180.0);
    }
}
