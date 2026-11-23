package com.lifelink.common;

import com.lifelink.inventory.InventoryService;
import com.lifelink.notification.NotificationService;
import com.lifelink.reservation.ReservationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class LifecycleScheduler {
    private static final Logger log = LoggerFactory.getLogger(LifecycleScheduler.class);

    private final InventoryService inventoryService;
    private final ReservationService reservationService;
    private final NotificationService notificationService;

    public LifecycleScheduler(InventoryService inventoryService, ReservationService reservationService,
                              NotificationService notificationService) {
        this.inventoryService = inventoryService;
        this.reservationService = reservationService;
        this.notificationService = notificationService;
    }

    @Scheduled(fixedDelayString = "PT5M", initialDelayString = "PT30S")
    public void processLifecycle() {
        int expiredUnits = inventoryService.processExpiry();
        int expiredReservations = reservationService.expireReservations();
        int events = notificationService.processOutbox();
        if (expiredUnits > 0 || expiredReservations > 0 || events > 0) {
            log.info("Lifecycle job: units={}, reservations={}, outbox={}",
                    expiredUnits, expiredReservations, events);
        }
    }
}
