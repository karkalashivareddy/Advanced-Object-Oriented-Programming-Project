package com.lifelink.notification;

import com.lifelink.identity.AuthService;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.JwtService;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Authenticates STOMP CONNECT frames and restricts subscriptions to the caller's own queue. */
public final class StompAuthenticationInterceptor implements ChannelInterceptor {
    private final JwtService jwtService;
    private final AuthService authService;

    public StompAuthenticationInterceptor(JwtService jwtService, AuthService authService) {
        this.jwtService = jwtService;
        this.authService = authService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        accessor.setLeaveMutable(true);
        StompCommand command = accessor.getCommand();
        if (command == null) {
            return message;
        }
        if (command == StompCommand.CONNECT) {
            Authentication authentication = authenticate(accessor);
            accessor.setUser(authentication);
            SecurityContextHolder.getContext().setAuthentication(authentication);
            return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
        }
        if (command == StompCommand.DISCONNECT) {
            return message;
        }
        Authentication authentication = accessor.getUser() instanceof Authentication authenticated
                ? authenticated
                : SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser)) {
            throw new MessageDeliveryException("WebSocket authentication is required");
        }
        SecurityContextHolder.getContext().setAuthentication(authentication);
        if (command == StompCommand.SUBSCRIBE) {
            requireOwnQueue(accessor.getDestination(), (AuthenticatedUser) authentication.getPrincipal());
        }
        return message;
    }

    @Override
    public void afterSendCompletion(Message<?> message, MessageChannel channel, boolean sent, Exception ex) {
        SecurityContextHolder.clearContext();
    }

    private Authentication authenticate(StompHeaderAccessor accessor) {
        String token = bearerToken(accessor);
        if (token == null) {
            throw new MessageDeliveryException("Bearer token is required for WebSocket CONNECT");
        }
        try {
            Object subject = jwtService.parse(token).get("uid");
            if (!(subject instanceof Number number)) {
                throw new MessageDeliveryException("Invalid WebSocket token subject");
            }
            AuthenticatedUser user = authService.principal(number.longValue());
            return new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
        } catch (MessageDeliveryException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw new MessageDeliveryException("Invalid or expired WebSocket token: " + ex.getMessage());
        }
    }

    private String bearerToken(StompHeaderAccessor accessor) {
        String header = firstPresent(
                accessor.getFirstNativeHeader("Authorization"),
                accessor.getFirstNativeHeader("authorization"),
                stringHeader(accessor, "Authorization"),
                accessor.getPasscode(),
                accessor.getLogin());
        if (header == null) {
            return null;
        }
        if (header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return header.substring(7).trim();
        }
        return header.trim();
    }

    private String stringHeader(StompHeaderAccessor accessor, String name) {
        Object value = accessor.getHeader(name);
        return value == null ? null : String.valueOf(value);
    }

    private String firstPresent(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private void requireOwnQueue(String destination, AuthenticatedUser user) {
        if (destination == null || !destination.startsWith("/user/")) {
            throw new MessageDeliveryException("Only personal notification queues may be subscribed to");
        }
        boolean genericQueue = "/user/queue/notifications".equals(destination);
        boolean explicitQueue = destination.startsWith("/user/" + user.getUsername() + "/queue/");
        if (!genericQueue && !explicitQueue) {
            throw new MessageDeliveryException("Cannot subscribe to another user's notification queue");
        }
    }
}
