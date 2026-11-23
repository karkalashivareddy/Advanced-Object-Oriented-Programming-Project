package com.lifelink.notification;

import com.lifelink.common.BaseEntity;
import com.lifelink.identity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "notifications")
public class Notification extends BaseEntity {

    public enum Channel { IN_APP, EMAIL, SMS }
    public enum Status { PENDING, SENT, FAILED }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(nullable = false, length = 1000)
    private String body;

    @Column(nullable = false, length = 60)
    private String type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Channel channel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Status status = Status.PENDING;

    @Column(name = "read_at")
    private Instant readAt;

    protected Notification() {
    }

    public Notification(User user, String title, String body, String type, Channel channel) {
        if (title == null || title.isBlank() || body == null || body.isBlank()) {
            throw new IllegalArgumentException("Notification title and body are required");
        }
        this.user = user;
        this.title = title;
        this.body = body;
        this.type = type == null ? "GENERAL" : type;
        this.channel = channel == null ? Channel.IN_APP : channel;
    }

    public void markSent() { this.status = Status.SENT; }
    public void markFailed() { this.status = Status.FAILED; }
    public void markRead(Instant now) {
        if (readAt == null) {
            readAt = now;
        }
    }

    public User getUser() { return user; }
    public String getTitle() { return title; }
    public String getBody() { return body; }
    public String getType() { return type; }
    public Channel getChannel() { return channel; }
    public Status getStatus() { return status; }
    public Instant getReadAt() { return readAt; }
}
