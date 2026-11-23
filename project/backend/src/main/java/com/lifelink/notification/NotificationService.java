package com.lifelink.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lifelink.common.PageResponse;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.identity.OrganizationMembershipRepository;
import com.lifelink.identity.Role;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {
    private final NotificationRepository repository;
    private final OutboxEventRepository outboxRepository;
    private final UserRepository userRepository;
    private final OrganizationMembershipRepository membershipRepository;
    private final Map<Notification.Channel, NotificationChannel> channels;
    private final TenantAccessService tenantAccess;
    private final ObjectMapper objectMapper;

    public NotificationService(NotificationRepository repository,
                               OutboxEventRepository outboxRepository,
                               UserRepository userRepository,
                               OrganizationMembershipRepository membershipRepository,
                               List<NotificationChannel> channelList,
                               TenantAccessService tenantAccess,
                               ObjectMapper objectMapper) {
        this.repository = repository;
        this.outboxRepository = outboxRepository;
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.channels = channelList.stream().collect(Collectors.toMap(
                NotificationChannel::supportedChannel, Function.identity()));
        this.tenantAccess = tenantAccess;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void notifyUser(Long userId, String title, String body, String type) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return;
        }
        Notification notification = new Notification(user, title, body, type, Notification.Channel.IN_APP);
        repository.save(notification);
        outboxRepository.save(new OutboxEvent("notification.created", serialize(
                new NotificationPayload(userId, notification.getPublicId(), title, body, type))));
    }

    @Transactional
    public void notifyOrganizationAdmins(Long organizationId, String title, String body, String type) {
        membershipRepository.findByOrganizationId(organizationId).stream()
                .filter(m -> m.getRole() == Role.BLOOD_BANK_ADMIN || m.getRole() == Role.HOSPITAL_ADMIN)
                .map(m -> m.getUser().getId())
                .distinct()
                .forEach(userId -> notifyUser(userId, title, body, type));
    }

    @Transactional(readOnly = true)
    public PageResponse<View> list(Pageable pageable) {
        Page<Notification> page = repository.findAllByUserIdOrderByCreatedAtDesc(
                tenantAccess.currentUser().userId(), pageable);
        return PageResponse.from(page, View::of);
    }

    @Transactional(readOnly = true)
    public long unreadCount() {
        return repository.countByUserIdAndReadAtIsNull(tenantAccess.currentUser().userId());
    }

    @Transactional
    public void markRead(Long id) {
        Notification notification = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", id));
        if (!notification.getUser().getId().equals(tenantAccess.currentUser().userId())) {
            throw new ResourceNotFoundException("Notification", id);
        }
        notification.markRead(Instant.now());
    }

    @Transactional
    public int processOutbox() {
        List<OutboxEvent> events = outboxRepository.findDue(Instant.now());
        for (OutboxEvent event : events) {
            event.markProcessing();
            try {
                NotificationPayload payload = objectMapper.readValue(event.getPayload(), NotificationPayload.class);
                Notification notification = repository.findByPublicId(payload.notificationPublicId())
                        .orElseThrow(() -> new IllegalStateException("Notification missing for outbox event"));
                NotificationChannel channel = channels.get(notification.getChannel());
                if (channel == null) {
                    notification.markFailed();
                    event.markFailed("No channel implementation", Instant.now().plus(1, ChronoUnit.MINUTES));
                    continue;
                }
                var result = channel.send(notification);
                if (result.delivered()) {
                    notification.markSent();
                    event.markProcessed();
                } else {
                    notification.markFailed();
                    event.markFailed(result.detail(), Instant.now().plus(5, ChronoUnit.MINUTES));
                }
            } catch (Exception ex) {
                event.markFailed(ex.getMessage(), Instant.now().plus(5, ChronoUnit.MINUTES));
            }
        }
        return events.size();
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to serialize event", ex);
        }
    }

    public record NotificationPayload(Long userId, String notificationPublicId, String title, String body, String type) {
    }

    public record View(Long id, String publicId, String title, String body, String type,
                       Notification.Channel channel, Notification.Status status, Instant createdAt, boolean read) {
        public static View of(Notification notification) {
            return new View(notification.getId(), notification.getPublicId(), notification.getTitle(),
                    notification.getBody(), notification.getType(), notification.getChannel(),
                    notification.getStatus(), notification.getCreatedAt(), notification.getReadAt() != null);
        }
    }
}
