package com.lifelink.notification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lifelink.identity.AuthService;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.JwtService;
import com.lifelink.identity.Permission;
import com.lifelink.identity.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.MalformedJwtException;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

class StompAuthenticationInterceptorTest {

    private final JwtService jwtService = mock(JwtService.class);
    private final AuthService authService = mock(AuthService.class);
    private final StompAuthenticationInterceptor interceptor =
            new StompAuthenticationInterceptor(jwtService, authService);
    private final MessageChannel channel = mock(MessageChannel.class);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void connectRequiresBearerToken() {
        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(message(StompCommand.CONNECT, a -> {}), channel));
    }

    @Test
    void connectRejectsRawPasscodeToken() {
        Message<byte[]> message = message(StompCommand.CONNECT, accessor -> {
            accessor.setPasscode("raw-token");
            accessor.setLogin("member@example.test");
        });

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(message, channel));
        verify(jwtService, never()).parse("raw-token");
    }

    @Test
    void connectAuthenticatesJwtSubjectAndTokenVersion() {
        Claims claims = mock(Claims.class);
        when(claims.get("uid")).thenReturn(42L);
        when(claims.getId()).thenReturn("jti-1");
        when(claims.get(JwtService.TOKEN_VERSION_CLAIM, String.class)).thenReturn("version-1");
        when(jwtService.parse("valid-jwt")).thenReturn(claims);
        AuthenticatedUser user = user();
        when(authService.principal(42L, "version-1")).thenReturn(user);

        Message<byte[]> message = message(StompCommand.CONNECT,
                accessor -> accessor.setNativeHeader("Authorization", "Bearer valid-jwt"));

        Message<?> result = interceptor.preSend(message, channel);
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
        Authentication authentication = assertInstanceOf(Authentication.class, resultAccessor.getUser());
        assertEquals("member@example.test", authentication.getName());
        verify(authService).principal(42L, "version-1");
    }

    @Test
    void connectAuthenticationIsReusedByLaterFramesFromSessionAttributes() {
        Claims claims = mock(Claims.class);
        when(claims.get("uid")).thenReturn(42L);
        when(claims.getId()).thenReturn("jti-persist");
        when(jwtService.parse("valid-jwt")).thenReturn(claims);
        AuthenticatedUser user = user();
        when(authService.principal(42L, null)).thenReturn(user);
        Map<String, Object> sessionAttributes = new HashMap<>();
        Message<byte[]> connect = message(StompCommand.CONNECT, sessionAttributes,
                accessor -> accessor.setNativeHeader("Authorization", "Bearer valid-jwt"));

        interceptor.preSend(connect, channel);
        SecurityContextHolder.clearContext();
        Message<byte[]> subscribe = message(StompCommand.SUBSCRIBE, sessionAttributes,
                accessor -> accessor.setDestination("/user/queue/notifications"));

        interceptor.preSend(subscribe, channel);

        assertEquals("member@example.test",
                SecurityContextHolder.getContext().getAuthentication().getName());
    }

    @Test
    void subscribeRejectsThreadLocalAuthenticationWithoutSessionAuthentication() {
        SecurityContextHolder.getContext().setAuthentication(authentication(user()));
        Message<byte[]> subscribe = message(StompCommand.SUBSCRIBE, new HashMap<>(),
                accessor -> accessor.setDestination("/user/queue/notifications"));

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(subscribe, channel));
    }

    @Test
    void connectRejectsRevokedAccessToken() {
        Claims claims = mock(Claims.class);
        when(claims.get("uid")).thenReturn(42L);
        when(claims.getId()).thenReturn("jti-revoked");
        when(jwtService.parse("revoked-jwt")).thenReturn(claims);
        when(authService.isAccessTokenRevoked("jti-revoked")).thenReturn(true);
        Message<byte[]> message = message(StompCommand.CONNECT,
                accessor -> accessor.setNativeHeader("Authorization", "Bearer revoked-jwt"));

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(message, channel));
        verify(authService).isAccessTokenRevoked("jti-revoked");
    }

    @Test
    void connectRejectsInvalidToken() {
        when(jwtService.parse("invalid")).thenThrow(new MalformedJwtException("malformed"));
        Message<byte[]> message = message(StompCommand.CONNECT,
                accessor -> accessor.setNativeHeader("Authorization", "Bearer invalid"));

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(message, channel));
    }

    @Test
    void connectRejectsExpiredToken() {
        when(jwtService.parse("expired")).thenThrow(new ExpiredJwtException(null, null, "expired"));
        Message<byte[]> message = message(StompCommand.CONNECT,
                accessor -> accessor.setNativeHeader("Authorization", "Bearer expired"));

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(message, channel));
    }

    @Test
    void connectRejectsTokenWithoutUid() {
        Claims claims = mock(Claims.class);
        when(jwtService.parse("no-uid")).thenReturn(claims);
        Message<byte[]> message = message(StompCommand.CONNECT,
                accessor -> accessor.setNativeHeader("Authorization", "Bearer no-uid"));

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(message, channel));
    }

    @Test
    void subscribeCannotTargetAnotherUsersQueue() {
        Message<byte[]> message = message(StompCommand.SUBSCRIBE, accessor -> {
            accessor.setDestination("/user/other@example.test/queue/notifications");
            accessor.setUser(authentication(user()));
        });

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(message, channel));
    }

    @Test
    void subscribeToOwnGenericQueueIsAllowed() {
        Message<byte[]> message = message(StompCommand.SUBSCRIBE, accessor -> {
            accessor.setDestination("/user/queue/notifications");
            accessor.setUser(authentication(user()));
        });

        assertEquals(message, interceptor.preSend(message, channel));
    }

    @Test
    void subscribeRequiresNotificationReadPermission() {
        AuthenticatedUser withoutPermission = new AuthenticatedUser(43L, "member@example.test", "Test Member",
                Set.of(Role.DONOR), Set.of(Permission.DONOR_READ), Set.of(), Set.of());
        Message<byte[]> message = message(StompCommand.SUBSCRIBE, accessor -> {
            accessor.setDestination("/user/queue/notifications");
            accessor.setUser(authentication(withoutPermission));
        });

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(message, channel));
    }

    @Test
    void sendToApplicationDestinationIsRejected() {
        Message<byte[]> message = message(StompCommand.SEND, accessor -> {
            accessor.setDestination("/app/notification");
            accessor.setUser(authentication(user()));
        });

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(message, channel));
    }

    @Test
    void sendToBrokerDestinationIsRejected() {
        Message<byte[]> message = message(StompCommand.SEND, accessor -> {
            accessor.setDestination("/topic/notifications");
            accessor.setUser(authentication(user()));
        });

        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(message, channel));
    }

    @Test
    void afterSendCompletionClearsSecurityContext() {
        SecurityContextHolder.getContext().setAuthentication(authentication(user()));
        Message<byte[]> message = message(StompCommand.SUBSCRIBE, a -> {});

        interceptor.afterSendCompletion(message, channel, true, null);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    private Message<byte[]> message(StompCommand command, java.util.function.Consumer<StompHeaderAccessor> customize) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        customize.accept(accessor);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private Message<byte[]> message(StompCommand command, Map<String, Object> sessionAttributes,
            java.util.function.Consumer<StompHeaderAccessor> customize) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        accessor.setSessionAttributes(sessionAttributes);
        customize.accept(accessor);
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private Authentication authentication(AuthenticatedUser user) {
        return new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
    }

    private AuthenticatedUser user() {
        return new AuthenticatedUser(42L, "member@example.test", "Test Member",
                Set.of(Role.DONOR), EnumSet.of(Permission.DONOR_READ, Permission.NOTIFICATION_READ),
                Set.of(), Set.of());
    }
}
