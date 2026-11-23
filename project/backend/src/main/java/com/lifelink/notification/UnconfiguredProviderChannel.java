package com.lifelink.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Explicit local-development adapter. It never claims that an external message was
 * delivered: notifications remain FAILED until a real provider adapter is configured.
 */
@Component
public class UnconfiguredProviderChannel implements NotificationChannel {
    private static final Logger log = LoggerFactory.getLogger(UnconfiguredProviderChannel.class);

    @Override
    public Notification.Channel supportedChannel() {
        return Notification.Channel.EMAIL;
    }

    @Override
    public DeliveryResult send(Notification notification) {
        log.warn("No email/SMS provider configured. Notification {} was NOT delivered externally.",
                notification.getPublicId());
        return DeliveryResult.failure("No external provider configured; notification was not delivered");
    }
}
