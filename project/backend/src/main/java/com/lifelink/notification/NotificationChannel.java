package com.lifelink.notification;

public interface NotificationChannel {
    Notification.Channel supportedChannel();

    DeliveryResult send(Notification notification);

    record DeliveryResult(boolean delivered, String detail) {
        public static DeliveryResult success(String detail) {
            return new DeliveryResult(true, detail);
        }

        public static DeliveryResult failure(String detail) {
            return new DeliveryResult(false, detail);
        }
    }
}
