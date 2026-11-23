package com.lifelink.notification;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class InAppNotificationChannel implements NotificationChannel {

    private final SimpMessagingTemplate messagingTemplate;

    public InAppNotificationChannel(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @Override
    public Notification.Channel supportedChannel() {
        return Notification.Channel.IN_APP;
    }

    @Override
    public DeliveryResult send(Notification notification) {
        messagingTemplate.convertAndSendToUser(
                notification.getUser().getEmail(),
                "/queue/notifications",
                new NotificationEvent(notification.getPublicId(), notification.getTitle(),
                        notification.getBody(), notification.getType()));
        return DeliveryResult.success("Delivered to authenticated in-app topic");
    }

    public record NotificationEvent(String publicId, String title, String body, String type) {
    }
}
