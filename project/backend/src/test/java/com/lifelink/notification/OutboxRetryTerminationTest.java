package com.lifelink.notification;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;

@SpringBootTest(properties = {"lifelink.seed.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:lifelink-outbox-retry;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;DEFAULT_NULL_ORDERING=HIGH"})
@ActiveProfiles("test")
class OutboxRetryTerminationTest {
    @Autowired
    private OutboxEventRepository outbox;
    @Autowired
    private NotificationService notifications;

    @Test
    void failingEventIsAttemptedFiveTimesThenBecomesTerminal() {
        outbox.deleteAll();
        OutboxEvent event = outbox.save(new OutboxEvent("notification.created",
                "{\"userId\":1,\"notificationPublicId\":\"missing-notification\","
                        + "\"title\":\"t\",\"body\":\"b\",\"type\":\"t\"}"));

        for (int attempt = 1; attempt <= 5; attempt++) {
            assertEquals(1, notifications.processOutbox());
            event = outbox.findById(event.getId()).orElseThrow();
            assertEquals(attempt, event.getAttempts());
            assertEquals(attempt < 5 ? OutboxEvent.Status.PENDING : OutboxEvent.Status.FAILED,
                    event.getStatus());
            // Simulate the retry delay elapsing without waiting five real minutes.
            ReflectionTestUtils.setField(event, "nextAttemptAt", Instant.now().minusSeconds(1));
            outbox.save(event);
        }

        assertEquals(5, event.getAttempts());
        assertEquals(OutboxEvent.Status.FAILED, event.getStatus());
        assertEquals(0, notifications.processOutbox());
        assertEquals(5, outbox.findById(event.getId()).orElseThrow().getAttempts());
    }
}
