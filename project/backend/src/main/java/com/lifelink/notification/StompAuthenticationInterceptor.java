package com.lifelink.notification;

import com.lifelink.identity.AuthService;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.JwtService;
import com.lifelink.identity.Permission;
import java.util.Map;
import java.util.Set;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Authenticates STOMP CONNECT frames and restricts subscriptions and SEND frames. */
public final class StompAuthenticationInterceptor implements ChannelInterceptor {
    /** No @MessageMapping handlers are registered, so no application SEND destination is allowed. */
    private static final Set<String> ALLOWED_SEND_DESTINATIONS = Set.of();

    /** Server-side session fallback for transports that do not invoke the user-change callback. */
    private static final String AUTHENTICATION_SESSION_ATTRIBUTE =
            StompAuthenticationInterceptor.class.getName() + ".AUTHENTICATION";

    private final JwtService jwtService;
    private final AuthService authService;

    public StompAuthenticationInterceptor(JwtService jwtService, AuthService authService) {
        this.jwtService = jwtService;
        this.authService = authService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        // Prefer the accessor attached by StompSubProtocolHandler: it owns the
        // user-change callback that propagates a CONNECT principal to later frames.
        // Wrapping would silently drop that callback and lose the authenticated user.
        StompHeaderAccessor attached = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        final boolean copyRequired;
        final StompHeaderAccessor accessor;
        if (attached == null) {
            accessor = StompHeaderAccessor.wrap(message);
            copyRequired = true;
        } else if (attached.isMutable()) {
            accessor = attached;
            accessor.setLeaveMutable(true);
            copyRequired = false;
        } else {
            accessor = (StompHeaderAccessor) MessageHeaderAccessor.getMutableAccessor(message);
            copyRequired = true;
        }
        StompCommand command = accessor.getCommand();
        if (command == null) {
            return message;
        }
        if (isConnect(command)) {
            Authentication authentication = authenticate(accessor);
            accessor.setUser(authentication);
            SecurityContextHolder.getContext().setAuthentication(authentication);
            Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
            if (sessionAttributes != null) {
                // Server-side fallback for transports that cannot invoke the callback.
                sessionAttributes.put(AUTHENTICATION_SESSION_ATTRIBUTE, authentication);
            }
            return copyRequired
                    ? MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders())
                    : message;
        }
        if (command == StompCommand.DISCONNECT) {
            return message;
        }
        Authentication authentication = accessor.getUser() instanceof Authentication frameAuthentication
                ? frameAuthentication
                : authenticationFromSession(accessor.getSessionAttributes());
        // Deliberately do not fall back to SecurityContextHolder here: it is thread-local
        // and could contain another session's authentication on pooled broker threads.
        if (!(authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser)) {
            throw new MessageDeliveryException("WebSocket authentication is required");
        }
        SecurityContextHolder.getContext().setAuthentication(authentication);
        AuthenticatedUser user = (AuthenticatedUser) authentication.getPrincipal();
        if (command == StompCommand.SUBSCRIBE) {
            requireOwnQueue(accessor.getDestination(), user);
        } else if (command == StompCommand.SEND) {
            requireApplicationDestination(accessor.getDestination());
        }
        return message;
    }

    @Override
    public void afterSendCompletion(Message<?> message, MessageChannel channel, boolean sent, Exception ex) {
        SecurityContextHolder.clearContext();
    }

    private static boolean isConnect(StompCommand command) {
        return command == StompCommand.CONNECT || command == StompCommand.STOMP;
    }

    private static Authentication authenticationFromSession(Map<String, Object> sessionAttributes) {
        if (sessionAttributes == null) {
            return null;
        }
        Object authentication = sessionAttributes.get(AUTHENTICATION_SESSION_ATTRIBUTE);
        return authentication instanceof Authentication sessionAuthentication ? sessionAuthentication : null;
    }

    private Authentication authenticate(StompHeaderAccessor accessor) {
        String token = bearerToken(accessor);
        if (token == null) {
            throw new MessageDeliveryException("Bearer token is required for WebSocket CONNECT");
        }
        try {
            var claims = jwtService.parse(token);
            Object subject = claims.get("uid");
            if (!(subject instanceof Number number)) {
                throw new MessageDeliveryException("Invalid WebSocket token subject");
            }
            String jti = claims.getId();
            if (jti == null || jti.isBlank() || authService.isAccessTokenRevoked(jti)) {
                throw new MessageDeliveryException("Invalid or expired WebSocket token");
            }
            AuthenticatedUser user = authService.principal(
                    number.longValue(), claims.get(JwtService.TOKEN_VERSION_CLAIM, String.class));
            return new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
        } catch (MessageDeliveryException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw new MessageDeliveryException("Invalid or expired WebSocket token");
        }
    }

    private String bearerToken(StompHeaderAccessor accessor) {
        String candidate = firstPresent(
                accessor.getFirstNativeHeader("Authorization"),
                accessor.getFirstNativeHeader("authorization"),
                stringHeader(accessor, "Authorization"),
                accessor.getPasscode(),
                accessor.getLogin());
        if (candidate == null) {
            return null;
        }
        if (!candidate.regionMatches(true, 0, "Bearer ", 0, 7)) {
            throw new MessageDeliveryException("WebSocket CONNECT requires a Bearer token");
        }
        String token = candidate.substring(7).trim();
        if (token.isEmpty()) {
            throw new MessageDeliveryException("Bearer token is required for WebSocket CONNECT");
        }
        return token;
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
        if (!user.hasPermission(Permission.NOTIFICATION_READ)) {
            throw new MessageDeliveryException("Notification read permission is required to subscribe");
        }
        if (destination == null || !destination.startsWith("/user/")) {
            throw new MessageDeliveryException("Only personal notification queues may be subscribed to");
        }
        boolean genericQueue = "/user/queue/notifications".equals(destination);
        boolean explicitQueue = destination.startsWith("/user/" + user.getUsername() + "/queue/");
        if (!genericQueue && !explicitQueue) {
            throw new MessageDeliveryException("Cannot subscribe to another user's notification queue");
        }
    }

    private void requireApplicationDestination(String destination) {
        if (destination == null || !destination.startsWith("/app/")
                || !ALLOWED_SEND_DESTINATIONS.contains(destination)) {
            throw new MessageDeliveryException("Sending to this WebSocket destination is not permitted");
        }
    }
}
