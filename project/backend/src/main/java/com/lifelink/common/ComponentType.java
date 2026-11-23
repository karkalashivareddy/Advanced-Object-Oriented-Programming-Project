package com.lifelink.common;

import java.time.Duration;
import java.util.EnumMap;
import java.util.Map;

public enum ComponentType {
    WHOLE_BLOOD(Duration.ofDays(35)),
    RED_CELLS(Duration.ofDays(42)),
    PLASMA(Duration.ofDays(365)),
    PLATELETS(Duration.ofDays(5)),
    CRYOPRECIPITATE(Duration.ofDays(365));

    private static final Map<ComponentType, Duration> SHELF_LIFE = new EnumMap<>(ComponentType.class);

    static {
        for (ComponentType type : values()) {
            SHELF_LIFE.put(type, type.defaultShelfLife);
        }
    }

    private final Duration defaultShelfLife;

    ComponentType(Duration defaultShelfLife) {
        this.defaultShelfLife = defaultShelfLife;
    }

    public Duration defaultShelfLife() {
        return SHELF_LIFE.get(this);
    }
}
